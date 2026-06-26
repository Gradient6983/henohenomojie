<script lang="ts">
  import { onMount } from "svelte";
  import Manager from "./manager";
  import type { CharPos, Color } from "./type";
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
    type SongLyricsBundle,
    buildPlacementRecords,
    downloadText,
    extractSongLyrics,
    getCharsByPhrase,
    toSongJsonl,
  } from "./webgpu/glyph/replayIO";
  import songSource from "./webgpu/glyph/songSource";
  const songCatalog = songSource;

  const imageCatalog = songCatalog.map((song) => ({
    id: song.imageId,
    label: `${song.label} image`,
  }));

  const charCanvasLayout = createCharCanvasLayout();
  const charCanvasSize = charCanvasLayout.canvasPixelSize;

  let finalCanvas: HTMLCanvasElement | null = null;
  let charCanvas: HTMLCanvasElement | null = null;

  // 토큰 입력 UI 없이 고정 토큰 사용
  const textAliveToken = "EP1gDDyqnNEHrnOD";
  let selectedSongId = $state(songCatalog[0].id);
  let selectedImageId = $state(songCatalog[0].imageId);
  let selectedPhraseId = $state<string | null>(null);
  let extractedBundlesBySongId = $state<Record<string, SongLyricsBundle>>({});
  let statusMessage = $state("");
  let isBusy = $state(false);

  let currentChar = $state("");
  let currentIndex = $state(0);
  let currentDisplayCharIndex = $state(0);

  let dataList = $state<CharPos[]>([]);
  let colors = $state<Color[]>([]);
  let diffs = $state<number[]>([]);
  let diffRanks = $state<number[]>([]);
  let currentCandidateIndex = $state(0);
  let computedResults = $state<GlyphStepResult[]>([]);

  const selectedSong = $derived(
    songCatalog.find((song) => song.id === selectedSongId) ?? songCatalog[0],
  );
  const selectedBundle = $derived(
    extractedBundlesBySongId[selectedSongId] ?? null,
  );
  const phraseChars = $derived(
    selectedBundle ? getCharsByPhrase(selectedBundle, selectedPhraseId) : null,
  );
  const filteredText = $derived(
    phraseChars ? phraseChars.map((char) => char.text).join("") : "",
  );
  const processedText = $derived(getRenderableChars(filteredText));

  function resetComputeState() {
    currentIndex = 0;
    currentDisplayCharIndex = 0;
    dataList = [];
    colors = [];
    diffs = [];
    diffRanks = [];
    currentCandidateIndex = 0;
    computedResults = [];
    currentChar = processedText[0] ?? "";
    drawText();
  }

  async function loadSelectedImageToCanvas() {
    if (!finalCanvas) return;
    await Manager.initWithImageAndCanvas(selectedSong.imageUrl, finalCanvas);
  }

  function drawText() {
    if (!charCanvas) return;
    drawCenteredChar(charCanvas, currentChar, charCanvasLayout);
  }

  async function handleSongChange() {
    selectedImageId = selectedSong.imageId;
    selectedPhraseId = null;
    resetComputeState();
    await loadSelectedImageToCanvas();
  }

  async function handleImageChange() {
    const mappedSong = songCatalog.find(
      (song) => song.imageId === selectedImageId,
    );
    if (!mappedSong) return;
    selectedSongId = mappedSong.id;
    selectedPhraseId = null;
    resetComputeState();
    await loadSelectedImageToCanvas();
  }

  function handleSelectPhrase(phraseId: string | null) {
    selectedPhraseId = phraseId;
    resetComputeState();
  }

  async function handleExtractSelectedSongLyrics() {
    if (!textAliveToken) {
      statusMessage = "App.svelte에서 TextAlive token을 설정해 주세요.";
      return;
    }

    try {
      isBusy = true;
      statusMessage = `${selectedSong.label} 가사를 추출 중...`;
      const bundle = await extractSongLyrics(textAliveToken, selectedSong);
      extractedBundlesBySongId[selectedSong.id] = bundle;
      selectedPhraseId = null;
      resetComputeState();
      statusMessage = `${selectedSong.label} 가사 추출 완료`;
    } catch (error) {
      statusMessage = `가사 추출 실패: ${error instanceof Error ? error.message : "unknown error"}`;
    } finally {
      isBusy = false;
    }
  }

  async function handleCompute() {
    if (!charCanvas || !finalCanvas) return;

    if (processedText.length === 0) {
      statusMessage = "계산할 텍스트가 없습니다.";
      return;
    }

    const nextResults: GlyphStepResult[] = [];
    const result = await runGlyphComputeWorkflow({
      processedText,
      startIndex: currentIndex,
      charCanvas,
      textOnlyImage: finalCanvas,
      renderChar: (char) => {
        currentChar = char;
        drawText();
      },
      onUpdate: (snapshot) => {
        currentChar = snapshot.currentChar;
        currentIndex = snapshot.currentIndex;
        currentDisplayCharIndex = snapshot.currentDisplayCharIndex;
        dataList = snapshot.dataList;
        colors = snapshot.colors;
        diffs = snapshot.diffs;
        diffRanks = snapshot.diffRanks;
      },
      onStepResult: (stepResult) => {
        nextResults.push(stepResult);
      },
    });

    currentChar = result.currentChar;
    currentIndex = result.currentIndex;
    currentDisplayCharIndex = result.currentDisplayCharIndex;
    dataList = result.dataList;
    colors = result.colors;
    diffs = result.diffs;
    diffRanks = result.diffRanks;
    computedResults = nextResults;
    statusMessage = `compute 완료 (${computedResults.length} steps)`;
    drawText();
  }

  function handleExportSelectedSongJsonl() {
    if (!selectedBundle) {
      statusMessage = "먼저 선택 곡 가사를 추출해 주세요.";
      return;
    }
    if (computedResults.length === 0) {
      statusMessage = "먼저 compute를 완료해 주세요.";
      return;
    }

    const charsForPlacement = getCharsByPhrase(
      selectedBundle,
      selectedPhraseId,
    );
    const placements = buildPlacementRecords(
      selectedBundle.song.songId,
      charsForPlacement,
      computedResults,
    );
    downloadText(
      toSongJsonl(selectedBundle, placements),
      `${selectedBundle.song.songId}.jsonl`,
    );
    statusMessage = `${selectedBundle.song.songId}.jsonl 내보내기 완료`;
  }

  onMount(async () => {
    finalCanvas = document.getElementById(
      "final-canvas",
    ) as HTMLCanvasElement | null;
    charCanvas = document.getElementById(
      "char-canvas",
    ) as HTMLCanvasElement | null;
    await loadSelectedImageToCanvas();
    resetComputeState();
  });
</script>

<div class="app-container">
  <div class="result-container">
    <canvas id="final-canvas" class="result-canvas"></canvas>
  </div>

  <div class="container">
    <div>
      <div class="toolbar">
        <label class="field">
          <span>Song</span>
          <select bind:value={selectedSongId} onchange={handleSongChange}>
            {#each songCatalog as song (song.id)}
              <option value={song.id}>{song.label}</option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span>Image</span>
          <select bind:value={selectedImageId} onchange={handleImageChange}>
            {#each imageCatalog as image (image.id)}
              <option value={image.id}>{image.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="phrase-toolbar">
        <span>Phrase</span>
        <button
          class:active={selectedPhraseId === null}
          onclick={() => handleSelectPhrase(null)}
          disabled={!selectedBundle}
        >
          all
        </button>
        {#if selectedBundle}
          {#each selectedBundle.phrases as phrase (phrase.phraseId)}
            <button
              class:active={selectedPhraseId === phrase.phraseId}
              onclick={() => handleSelectPhrase(phrase.phraseId)}
            >
              {phrase.text || "(blank)"}
            </button>
          {/each}
        {/if}
      </div>

      <canvas
        id="char-canvas"
        width={charCanvasSize}
        height={charCanvasSize}
        class="char-canvas"
      ></canvas>
      <div class="button-row">
        <button onclick={handleExtractSelectedSongLyrics} disabled={isBusy}>
          extract selected song lyrics
        </button>
      </div>
      <div class="button-row">
        <button onclick={handleCompute} disabled={isBusy || !selectedBundle}>
          compute
        </button>
        <button
          onclick={handleExportSelectedSongJsonl}
          disabled={isBusy || !selectedBundle || computedResults.length === 0}
        >
          save processed jsonl
        </button>
      </div>
      <p>computed steps: {computedResults.length}</p>
      <p>renderable chars: {processedText.length}</p>
      {#if statusMessage}
        <p class="status">{statusMessage}</p>
      {/if}
    </div>

    <div>
      <div>
        <p>Text: {currentDisplayCharIndex}</p>
        <p>Current: {currentChar}</p>
        <p>Index: {currentIndex}</p>
        {#if diffRanks.length > 0}
          {@const idx = diffRanks[currentCandidateIndex]}
          <p>Candidate {diffRanks.length} created</p>
          <table>
            <tbody>
              <tr>
                <th> index </th>
                <td>{idx + 1}</td>
              </tr>
              <tr>
                <th> x </th>
                <td>{dataList[idx].x.toFixed(2)}</td>
              </tr>
              <tr>
                <th> y </th>
                <td>{dataList[idx].y.toFixed(2)}</td>
              </tr>
              <tr>
                <th> scale </th>
                <td>{dataList[idx].scale.toFixed(2)}</td>
              </tr>
              <tr>
                <th> opacity </th>
                <td>{dataList[idx].opacity.toFixed(2)}</td>
              </tr>
              <tr>
                <th> rotation </th>
                <td>{dataList[idx].rotation.toFixed(2)}</td>
              </tr>
              <tr>
                <th> diff </th>
                <td>{diffs[idx]}</td>
              </tr>
              <tr>
                <th> color </th>
                <td>{colors[idx].map((c) => Math.trunc(c * 255)).join(", ")}</td
                >
              </tr>
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .app-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }

  .result-container {
    width: min(90vw, 960px);
  }

  canvas {
    border: 1px solid black;
  }

  .result-canvas {
    width: 100%;
    display: block;
    background-color: #ffffff;
  }

  .char-canvas {
    width: 200px;
    background-color: #ffffff;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 220px;
  }

  .field select {
    padding: 6px 8px;
  }

  .phrase-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
    max-width: 560px;
  }

  .phrase-toolbar button,
  .button-row button {
    padding: 4px 8px;
  }

  .phrase-toolbar button.active {
    border: 1px solid #111111;
    background: #e7f1ff;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .status {
    max-width: 560px;
    color: #134c8c;
  }

  .container {
    margin: 0 auto;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 10px;
    width: min(90vw, 960px);
  }
</style>
