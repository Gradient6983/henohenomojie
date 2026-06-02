<script lang="ts">
  import { onMount } from "svelte";
  import canvasDrawImage from "./image";
  import { createRandomDataList, loadImage, updateCanvasSize } from "./util";
  import { execute } from "./compute";
  import sampleImage from "./assets/sample.png";
  import Manager from "./manager";
  import { drawDifference } from "./difference";
  import { drawDiffDebug } from "./diffDebug";
  import type { Color } from "./type";

  let canvas = $state<HTMLCanvasElement | null>(null);
  let debugCanvas = $state<HTMLCanvasElement | null>(null);
  let differenceCanvas = $state<HTMLCanvasElement | null>(null);
  let evolutionCanvas = $state<HTMLCanvasElement | null>(null);

  onMount(async () => {
    if (!canvas || !debugCanvas || !differenceCanvas || !evolutionCanvas)
      return;
    await loadImage(sampleImage);
    updateCanvasSize(canvas);
    updateCanvasSize(debugCanvas);
    updateCanvasSize(differenceCanvas);
    updateCanvasSize(evolutionCanvas);
    await canvasDrawImage(canvas);
    await drawDifference(differenceCanvas);
  });

  // let count = $state(0);
  // let incrementBy = $state(10);

  // async function handleClick() {
  //   const state = await execute();
  //   count = state.counter;
  //   incrementBy = state.incrementBy;
  // }

  // onMount(() => {
  //   if (canvas) render(canvas);
  // });

  const devicePixelRatio = window.devicePixelRatio || 1;

  const charSize = 100;
  const charPadding = 10;
  const charCanvasSize = Math.ceil(
    (charSize + charPadding * 2) * devicePixelRatio,
  );
  const charStyleSize = Math.ceil(charSize + charPadding * 2);

  const fontFamily = "Pretendard JP Variable";
  const fontWeight = 700;
  const font = `${fontWeight} ${charSize}px ${fontFamily}`;
  const textColor = "rgb(255, 255, 255)";

  const text = "안녕하세요 반가워\n새로운 텍스트";
  const emptySpaceRegex = /^\s*$/;
  const processedText = text
    .split("")
    .filter((char) => !emptySpaceRegex.test(char));

  let charCanvas = $state<HTMLCanvasElement | null>(null);

  let currentChar = $state(text[0]);
  let currentIndex = $state(0);

  let nextDisabled = $derived(currentIndex >= processedText.length - 1);

  function handleChar() {
    currentIndex++;
    currentChar = processedText[currentIndex];
    drawText();
  }

  function drawText() {
    if (!charCanvas) return;
    const ctx = charCanvas.getContext("2d");
    if (!ctx) return;

    // canvas 초기화
    // setTransform에 dpr을 적용해서 글자가 흐릿하게 표시되지 않도록 하기
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.font = font;
    ctx.fillStyle = textColor;

    const { width, actualBoundingBoxAscent, actualBoundingBoxDescent } =
      ctx.measureText(currentChar);

    // 글자를 화면 정중앙에 표시
    const x = charStyleSize / 2 - width / 2;
    const y =
      charStyleSize / 2 -
      actualBoundingBoxDescent / 2 +
      actualBoundingBoxAscent / 2;

    ctx.clearRect(0, 0, charCanvasSize, charCanvasSize);
    ctx.fillText(currentChar, x, y);
  }

  onMount(async () => {
    if (!charCanvas) return;
    drawText();
  });

  async function handleCompute() {
    if (!debugCanvas || !charCanvas) return;
    try {
      const dataList = createRandomDataList(
        {
          x: { min: 0.5, max: 0.5 },
          y: { min: 0.5, max: 0.5 },
          scale: { min: 1, max: 5 },
          opacity: { min: 0.1, max: 1 },
          rotation: { min: 0, max: 360 },
        },
        1,
      );
      console.log(dataList);
      const sampleAvgColors = await execute(dataList, debugCanvas, charCanvas);
      if (!sampleAvgColors) return;
      const color = [
        sampleAvgColors[0].r,
        sampleAvgColors[0].g,
        sampleAvgColors[0].b,
      ] as Color;
      await drawDiffDebug(color, dataList);
    } catch (e) {
      console.error("[compute] 실행 실패:", e);
    }
  }
</script>

<div>
  <!-- <button onclick={handleClick}>Click me</button>
  <p>Count: {count}</p>
  <p>Increment By: {incrementBy}</p> -->
  <div class="canvas-container">
    <canvas bind:this={canvas}></canvas>
    <canvas bind:this={debugCanvas}></canvas>
    <canvas bind:this={differenceCanvas}></canvas>
    <canvas bind:this={evolutionCanvas}></canvas>
  </div>

  <div class="container">
    <div>
      <!-- 원본 이미지 -->
      <canvas
        bind:this={charCanvas}
        width={charCanvasSize}
        height={charCanvasSize}
        style:width="{charStyleSize}px"
        style:height="{charStyleSize}px"
        class="char-canvas"
      ></canvas>
    </div>

    <div>
      <button onclick={handleCompute}>compute</button>
      <button onclick={() => handleChar()} disabled={nextDisabled}>next</button>
      <button>reset</button>
    </div>
    <div>
      <p>Text</p>
      <pre>{text}</pre>
      <p>Currnet: {currentChar}</p>
      <p>Index: {currentIndex}</p>
    </div>
  </div>
</div>

<style>
  canvas {
    border: 1px solid black;
  }
  .char-canvas {
    background-color: #000000;
  }
  .container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }
  .canvas-container {
    width: 80%;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
</style>
