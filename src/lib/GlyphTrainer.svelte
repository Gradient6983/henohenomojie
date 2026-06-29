<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Manager from "../manager";
  import { t } from "../i18n";
  import { runGlyphComputeWorkflow } from "../webgpu/glyph/glyphComputeWorkflow";
  import {
    computeSobelEdges,
    sobelResultToCanvas,
  } from "../webgpu/glyph/sobelFilter";
  import { extractSongLyrics, getCharsByPhrase } from "../textAlive/lyricsExtraction";
  import { buildPlacementRecords, toSongJsonl } from "../textAlive/songJsonl";
  import { setEdgeOverlay } from "../stores/edgeOverlayStore";
  import { setTrainedResult } from "../stores/trainedStore.svelte";
  import {
    createCharCanvasLayout,
    drawCenteredChar,
    getRenderableChars,
  } from "../util/textCanvas";
  import { normalizeImageShortSide } from "../util/image";
  import { formatTime } from "../util/time";
  import { TEXT_ALIVE_TOKEN } from "../const/textAlive";
  import type { GlyphStepResult } from "../types/glyph";
  import type { SongCatalogItem } from "../types/song";
  import type { TrainPhase } from "../types/train";

  let {
    imageUrl,
    song,
    signal,
    onPhaseChange,
  }: {
    /** Uploaded/sample image URL (original, before normalization) */
    imageUrl: string;
    /** Selected song */
    song: SongCatalogItem;
    /** Cancellation signal owned by the parent */
    signal?: AbortSignal;
    /** Notify the parent of progress phase changes */
    onPhaseChange: (phase: TrainPhase) => void;
  } = $props();

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

  // For measuring training time
  let trainStartMs = 0;
  let elapsedMs = $state(0);
  // Converge the estimated total time slowly with an EMA so the value doesn't fluctuate.
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

  // On a phase change, handle the internal state and parent notification together.
  function setPhase(next: TrainPhase) {
    phase = next;
    onPhaseChange(next);
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
      // Fit the short side to 1080 to unify the training data and coordinate distribution.
      const normalizedUrl = await normalizeImageShortSide(imageUrl, 1080);
      if (signal?.aborted) return;
      await Manager.initWithImageAndCanvas(normalizedUrl, finalEl);
      if (signal?.aborted) return;

      setPhase("extracting");
      statusMessage = `${song.label} · ${t().train.extracting}`;
      const bundle = await extractSongLyrics(TEXT_ALIVE_TOKEN, song);
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
          // Update the detail info only when a glyph's final position is confirmed.
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
      // 1) Build the placement results + lyrics into a jsonl string.
      const chars = getCharsByPhrase(bundle, null);
      const placements = buildPlacementRecords(
        bundle.song.songId,
        chars,
        results,
      );
      const jsonlRaw = toSongJsonl(bundle, placements);

      // 2) Extract the Sobel edges and convert them into an overlay canvas / data URL.
      const sobel = await computeSobelEdges();
      const edgeCanvas = sobelResultToCanvas(sobel);
      const edgeUrl = edgeCanvas.toDataURL("image/png");
      setEdgeOverlay({
        id: song.id,
        width: sobel.width,
        height: sobel.height,
        source: edgeCanvas,
      });

      // 3) Store in memory so it can be played in PixiPreviewPage like any other song.
      //    Overwrite the image with the normalized version so the coordinates/ratio match during playback.
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
        // Start updating the estimate slowly once enough progress has accumulated.
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
    color: var(--ink);
  }

  .result-wrap {
    width: 100%;
  }

  .result-canvas {
    width: 100%;
    display: block;
    background-color: #ffffff;
    border: 1px solid rgba(47, 79, 87, 0.12);
    border-radius: 4px;
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
    border: 1px solid rgba(47, 79, 87, 0.12);
    border-radius: 4px;
    flex: 0 0 auto;
  }

  .progress-card {
    flex: 1 1 240px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid rgba(91, 122, 130, 0.2);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.85);
  }

  .progress-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .count {
    font-size: 0.95rem;
    color: var(--ink);
  }

  .pct {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--teal-deep);
    font-variant-numeric: tabular-nums;
  }

  .bar {
    width: 100%;
    height: 10px;
    border-radius: 2px;
    background: rgba(47, 79, 87, 0.12);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--teal), var(--teal-deep));
    transition: width 0.2s ease;
  }

  .time-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.8rem;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .status {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }

  .detail-toggle {
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid rgba(43, 183, 172, 0.5);
    background: transparent;
    color: var(--teal-deep);
    cursor: pointer;
    font-size: 0.82rem;
  }

  .detail-toggle:hover {
    background: rgba(43, 183, 172, 0.1);
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
    border-bottom: 1px solid rgba(47, 79, 87, 0.1);
  }

  .detail th {
    color: var(--ink-soft);
    font-weight: 500;
  }

  .muted {
    margin: 12px 0 0;
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
