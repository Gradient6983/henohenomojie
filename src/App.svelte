<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Manager from "./manager";
  import { t } from "./i18n";
  import {
    createCharCanvasLayout,
    drawCenteredChar,
    getRenderableChars,
  } from "./webgpu/glyph/textCanvas";
  import {
    runGlyphComputeWorkflow,
    type GlyphStepResult,
  } from "./webgpu/glyph/glyphComputeWorkflow";
  import {
    type SongCatalogItem,
    buildPlacementRecords,
    extractSongLyrics,
    getCharsByPhrase,
    toSongJsonl,
  } from "./webgpu/glyph/replayIO";
  import {
    computeSobelEdges,
    sobelResultToCanvas,
  } from "./webgpu/glyph/sobelFilter";
  import { setEdgeOverlay } from "./webgpu/glyph/edgeOverlayStore";
  import { normalizeImageShortSide } from "./webgpu/glyph/normalizeImage";
  import { setTrainedResult } from "./trainedStore.svelte";

  type TrainPhase =
    | "preparing"
    | "extracting"
    | "training"
    | "finalizing"
    | "done"
    | "cancelled"
    | "error";

  let {
    imageUrl,
    song,
    signal,
    onPhaseChange,
  }: {
    /** 업로드/예시 이미지 URL (정규화 전 원본) */
    imageUrl: string;
    /** 선택한 곡 */
    song: SongCatalogItem;
    /** 부모가 소유한 취소 신호 */
    signal?: AbortSignal;
    /** 진행 단계 변화를 부모에 알린다 */
    onPhaseChange: (phase: TrainPhase) => void;
  } = $props();

  const textAliveToken = "EP1gDDyqnNEHrnOD";
  const charCanvasLayout = createCharCanvasLayout();
  const charCanvasSize = charCanvasLayout.canvasPixelSize;

  let finalCanvas = $state<HTMLCanvasElement | null>(null);
  let charCanvas = $state<HTMLCanvasElement | null>(null);

  let phase = $state<TrainPhase>("preparing");
  let statusMessage = $state("");
  let progressFraction = $state(0);
  let currentCharIndex = $state(0);
  let totalChars = $state(0);
  let currentChar = $state("");

  let lastPlacement = $state<GlyphStepResult | null>(null);
  let showDetails = $state(false);

  // 훈련 시간 측정용
  let trainStartMs = 0;
  let elapsedMs = $state(0);
  // 예상 총 시간은 EMA로 천천히 수렴시켜 값이 출렁이지 않게 한다.
  let smoothedTotalMs = $state(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const percentText = $derived((progressFraction * 100).toFixed(1));
  const displayCharNo = $derived(
    totalChars === 0
      ? 0
      : phase === "done"
        ? totalChars
        : Math.min(currentCharIndex + 1, totalChars),
  );

  // 단계 변경 시 내부 상태와 부모 알림을 한 번에 처리한다.
  function setPhase(next: TrainPhase) {
    phase = next;
    onPhaseChange(next);
  }

  function formatTime(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function drawText() {
    if (!charCanvas) return;
    drawCenteredChar(charCanvas, currentChar, charCanvasLayout);
  }

  async function runTraining() {
    const finalEl = finalCanvas;
    const charEl = charCanvas;
    if (!finalEl || !charEl) {
      setPhase("error");
      statusMessage = t().train.error;
      return;
    }

    try {
      setPhase("preparing");
      statusMessage = t().train.preparingImage;
      // 짧은 변을 1080으로 맞춰 학습 데이터와 좌표 분포를 통일한다.
      const normalizedUrl = await normalizeImageShortSide(imageUrl, 1080);
      if (signal?.aborted) return;
      await Manager.initWithImageAndCanvas(normalizedUrl, finalEl);
      if (signal?.aborted) return;

      setPhase("extracting");
      statusMessage = `${song.label} · ${t().train.extracting}`;
      const bundle = await extractSongLyrics(textAliveToken, song);
      if (signal?.aborted) return;

      const processedText = getRenderableChars(
        bundle.chars.map((c) => c.text).join(""),
      );
      totalChars = processedText.length;
      currentCharIndex = 0;
      currentChar = processedText[0] ?? "";
      drawText();

      if (processedText.length === 0) {
        setPhase("error");
        statusMessage = t().train.noText;
        return;
      }

      setPhase("training");
      statusMessage = t().train.training;
      trainStartMs = performance.now();
      const results: GlyphStepResult[] = [];
      await runGlyphComputeWorkflow({
        processedText,
        startIndex: 0,
        charCanvas: charEl,
        textOnlyImage: finalEl,
        renderChar: (char) => {
          currentChar = char;
          drawText();
        },
        onProgress: (progress) => {
          progressFraction = progress.fraction;
          currentCharIndex = progress.charIndex;
        },
        onStepResult: (result) => {
          results.push(result);
          // 한 글자의 최종 위치가 확정된 시점에만 상세 정보를 갱신한다.
          lastPlacement = result;
        },
        signal,
      });

      if (signal?.aborted) {
        setPhase("cancelled");
        statusMessage = t().train.cancelled;
        return;
      }
      progressFraction = 1;

      setPhase("finalizing");
      statusMessage = t().train.finalizing;
      // 1) 배치 결과 + 가사를 jsonl 문자열로 만든다.
      const chars = getCharsByPhrase(bundle, null);
      const placements = buildPlacementRecords(
        bundle.song.songId,
        chars,
        results,
      );
      const jsonlRaw = toSongJsonl(bundle, placements);

      // 2) Sobel 윤곽선을 추출해 오버레이용 캔버스/데이터 URL로 변환한다.
      const sobel = await computeSobelEdges();
      const edgeCanvas = sobelResultToCanvas(sobel);
      const edgeUrl = edgeCanvas.toDataURL("image/png");
      setEdgeOverlay({
        id: song.id,
        width: sobel.width,
        height: sobel.height,
        source: edgeCanvas,
      });

      // 3) 메모리에 저장해 PixiPreviewPage에서 다른 곡처럼 재생할 수 있게 한다.
      //    재생 시 좌표/비율이 맞도록 이미지는 정규화본으로 덮어쓴다.
      setTrainedResult({
        song: { ...song, imageUrl: normalizedUrl },
        jsonlRaw,
        edgeUrl,
      });

      setPhase("done");
      statusMessage = t().train.done;
    } catch (error) {
      if (signal?.aborted) {
        setPhase("cancelled");
        statusMessage = t().train.cancelled;
        return;
      }
      setPhase("error");
      statusMessage = `${t().train.error}: ${
        error instanceof Error ? error.message : "unknown error"
      }`;
    }
  }

  onMount(() => {
    void runTraining();
    timer = setInterval(() => {
      if (
        trainStartMs > 0 &&
        (phase === "training" || phase === "finalizing")
      ) {
        elapsedMs = performance.now() - trainStartMs;
        // 진행률이 어느 정도 쌓인 뒤부터 예상치를 천천히 갱신한다.
        if (progressFraction > 0.01) {
          const raw = elapsedMs / progressFraction;
          smoothedTotalMs =
            smoothedTotalMs > 0 ? smoothedTotalMs * 0.92 + raw * 0.08 : raw;
        }
      }
    }, 200);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });
</script>

<div class="train-root">
  <div class="result-wrap">
    <canvas bind:this={finalCanvas} class="result-canvas"></canvas>
  </div>

  <div class="progress-row">
    <canvas
      bind:this={charCanvas}
      width={charCanvasSize}
      height={charCanvasSize}
      class="char-canvas"
    ></canvas>

    <div class="progress-card">
      <div class="progress-head">
        <span class="count"
          >{displayCharNo} / {totalChars} {t().train.charUnit}</span
        >
        <span class="pct">{percentText}%</span>
      </div>
      <div class="bar">
        <div class="bar-fill" style="width: {progressFraction * 100}%"></div>
      </div>
      <div class="time-row">
        <span>{t().train.elapsed}: {formatTime(elapsedMs)}</span>
        <span>
          {t().train.estimatedTotal}:
          {smoothedTotalMs > 0 ? formatTime(smoothedTotalMs) : "--:--"}
        </span>
      </div>
      <p class="status">{statusMessage}</p>
    </div>
  </div>

  <div class="detail">
    <button
      type="button"
      class="detail-toggle"
      onclick={() => (showDetails = !showDetails)}
    >
      {showDetails ? t().train.hideDetails : t().train.showDetails}
    </button>

    {#if showDetails}
      {#if lastPlacement}
        <table>
          <tbody>
            <tr><th>step</th><td>{lastPlacement.step + 1}</td></tr>
            <tr><th>char</th><td>{lastPlacement.char}</td></tr>
            <tr><th>x</th><td>{lastPlacement.pos.x.toFixed(2)}</td></tr>
            <tr><th>y</th><td>{lastPlacement.pos.y.toFixed(2)}</td></tr>
            <tr><th>scale</th><td>{lastPlacement.pos.scale.toFixed(2)}</td></tr>
            <tr>
              <th>opacity</th><td>{lastPlacement.pos.opacity.toFixed(2)}</td>
            </tr>
            <tr>
              <th>rotation</th><td>{lastPlacement.pos.rotation.toFixed(2)}</td>
            </tr>
            <tr><th>diff</th><td>{lastPlacement.diff}</td></tr>
            <tr>
              <th>color</th>
              <td>
                {lastPlacement.color
                  .map((c) => Math.trunc(c * 255))
                  .join(", ")}
              </td>
            </tr>
          </tbody>
        </table>
      {:else}
        <p class="muted">{t().train.detailEmpty}</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .train-root {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: #fff;
  }

  .result-wrap {
    width: 100%;
  }

  .result-canvas {
    width: 100%;
    display: block;
    background-color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
  }

  .progress-row {
    display: flex;
    gap: 16px;
    align-items: stretch;
    flex-wrap: wrap;
  }

  .char-canvas {
    width: 120px;
    height: 120px;
    background-color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    flex: 0 0 auto;
  }

  .progress-card {
    flex: 1 1 240px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
  }

  .progress-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .count {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .pct {
    font-size: 1.4rem;
    font-weight: 700;
    color: #8fbcff;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    width: 100%;
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #6aa0ff, #8fbcff);
    transition: width 0.2s ease;
  }

  .time-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
    font-variant-numeric: tabular-nums;
  }

  .status {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .detail-toggle {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 0.82rem;
  }

  .detail-toggle:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .detail table {
    margin-top: 12px;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .detail th,
  .detail td {
    padding: 4px 12px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .detail th {
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
  }

  .muted {
    margin: 12px 0 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.45);
  }
</style>
