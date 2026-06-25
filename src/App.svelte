<script lang="ts">
  import { onMount } from "svelte";
  import sampleImage from "./assets/sample.png";
  import Manager from "./manager";
  import type { CharPos, Color } from "./type";
  import {
    createCharCanvasLayout,
    drawCenteredChar,
    getRenderableChars,
  } from "./webgpu/glyph/textCanvas";
  import { runGlyphComputeWorkflow } from "./webgpu/glyph/glyphComputeWorkflow";
  import { defaultText } from "./webgpu/glyph/textSource";

  let textOnlyImage: HTMLCanvasElement | null = null;
  let charCanvas: HTMLCanvasElement | null = null;
  let finalCanvas: HTMLCanvasElement | null = null;

  onMount(async () => {
    finalCanvas = document.getElementById("final-canvas") as HTMLCanvasElement | null;
    charCanvas = document.getElementById("char-canvas") as HTMLCanvasElement | null;

    if (!finalCanvas || !charCanvas) return;

    textOnlyImage = finalCanvas;

    await Manager.initWithImageAndCanvas(sampleImage, textOnlyImage);
    drawText();
  });

  const charCanvasLayout = createCharCanvasLayout();
  const charCanvasSize = charCanvasLayout.canvasPixelSize;

  const processedText = getRenderableChars(defaultText);

  let currentChar = $state(defaultText[0]);
  let currentIndex = $state(0);
  let currentDisplayCharIndex = $state(0);

  let dataList = $state<CharPos[]>([]);
  let colors = $state<Color[]>([]);
  let diffs = $state<number[]>([]);
  let diffRanks = $state<number[]>([]);
  let currentCandidateIndex = $state(0);

  function drawText() {
    if (!charCanvas) return;
    drawCenteredChar(charCanvas, currentChar, charCanvasLayout);
  }

  async function handleCompute() {
    if (!charCanvas || !textOnlyImage)
      return;

    const result = await runGlyphComputeWorkflow({
      processedText,
      startIndex: currentIndex,
      charCanvas,
      textOnlyImage,
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
    });

    currentChar = result.currentChar;
    currentIndex = result.currentIndex;
    currentDisplayCharIndex = result.currentDisplayCharIndex;
    dataList = result.dataList;
    colors = result.colors;
    diffs = result.diffs;
    diffRanks = result.diffRanks;
    drawText();
  }
</script>

<div class="app-container">
  <div class="result-container">
    <canvas id="final-canvas" class="result-canvas"></canvas>
  </div>

  <div class="container">
    <div>
      <canvas id="char-canvas" width={charCanvasSize} height={charCanvasSize} class="char-canvas"></canvas>
      <button onclick={handleCompute}>compute</button>
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
