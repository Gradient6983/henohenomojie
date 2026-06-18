<script lang="ts">
  import { onMount } from "svelte";
  import sampleImage from "./assets/sample.png";
  import Manager from "./manager";
  import type { CharPos, Color } from "./type";
  import { addRandomVariance, createRandomDataList } from "./util";
  import computeChar from "./webgpu/computeChar";
  import { computeColor } from "./webgpu/computeColor";
  import { debugDifference } from "./webgpu/debugDifference";
  import { drawDifference } from "./webgpu/drawDifference";
  import drawImage from "./webgpu/drawImage";

  let originalImage = $state<HTMLCanvasElement | null>(null);
  let textOnImage = $state<HTMLCanvasElement | null>(null);
  let imageDifference = $state<HTMLCanvasElement | null>(null);
  let textOnlyImage = $state<HTMLCanvasElement | null>(null);

  onMount(async () => {
    if (!originalImage || !textOnImage || !imageDifference || !textOnlyImage)
      return;
    await Manager.loadImage(sampleImage);
    Manager.initSizes();
    Manager.initTexture();

    const canvasList = [
      originalImage,
      textOnImage,
      imageDifference,
      textOnlyImage,
    ];
    for (const canvas of canvasList) {
      Manager.initCanvas(canvas);
    }
    await drawImage(originalImage);
    await drawDifference(imageDifference);

    // char canvas 초기화
  });

  const devicePixelRatio = window.devicePixelRatio || 1;

  const charSize = 960;
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

  let dataList = $state<CharPos[]>([]);
  let colors = $state<Color[]>([]);
  let diffs = $state<number[]>([]);
  let diffRanks = $state<number[]>([]);
  let currentCandidateIndex = $state(0);

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
    const firstCandidateNum = 1000;
    const epochNum = 10;
    const topCandidateNum = 50;
    // 글자 위치의 마지노선 값
    const charPosClip = {
      x: { min: 0, max: 1 },
      y: { min: 0, max: 1 },
      scale: { min: 0.1, max: 5 },
      opacity: { min: 0.1, max: 1 },
      rotation: { min: 0, max: 360 },
    };

    if (!textOnImage || !charCanvas) return;
    let diffArray: number[] = [];
    // 리스트 초기화
    let dataCandidateList: CharPos[] = createRandomDataList(
      {
        x: { min: 0, max: 1 },
        y: { min: 0, max: 1 },
        scale: { min: 1, max: 5 },
        opacity: { min: 0.5, max: 1 },
        rotation: { min: 0, max: 360 },
      },
      firstCandidateNum,
      charPosClip,
    );

    try {
      // 임시로 정의한 epochNum
      for (let i = 0; i < epochNum; i++) {
        const sampleAvgColors = await computeColor(
          dataCandidateList,
          textOnImage,
          charCanvas,
        );
        if (!sampleAvgColors) return;
        colors = sampleAvgColors.map(
          (color) => [color.r, color.g, color.b] as Color,
        );
        const result = await debugDifference(colors, dataCandidateList);
        if (!result) throw new Error("debugDifference failed");
        diffArray = result;

        // 상위 10개의 결과들에서 10개의 variance를 만듦
        // 초기 오브젝트들을 놓을 때는 variance를 크게 주다가 나중으로 가면 점점 작게 줌
        // 0.1이라는 수치는 임시적인 것이기 때문에 추후에 결과를 보고 수정이 필요함
        const top10 = dataCandidateList.slice(0, topCandidateNum);
        dataCandidateList = [];

        for (const data of top10) {
          const varianceList = addRandomVariance(
            data,
            Math.trunc(firstCandidateNum / topCandidateNum),
            0.1,
            charPosClip,
          );
          dataCandidateList.push(...varianceList);
        }
      }
      if (!diffArray) throw new Error("diffArray is undefined");
      diffs = diffArray;

      const diffWithIdx = diffArray.map((value, index) => ({ value, index }));
      const diffSorted = diffWithIdx.sort((a, b) => a.value - b.value);
      diffRanks = diffSorted.map((item) => item.index);
      dataList = dataCandidateList;
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
    <canvas bind:this={originalImage}></canvas>
    <canvas bind:this={textOnImage}></canvas>
    <canvas bind:this={imageDifference}></canvas>
    <canvas bind:this={textOnlyImage}></canvas>
  </div>

  <div class="container">
    <div>
      <!-- 원본 이미지 -->
      <canvas
        bind:this={charCanvas}
        width={charCanvasSize}
        height={charCanvasSize}
        class="char-canvas"
      ></canvas>
    </div>

    <div>
      <button onclick={handleCompute}>compute</button>
      <button onclick={() => handleChar()} disabled={nextDisabled}>next</button>
      <button>reset</button>

      <div>
        <p>Text</p>
        <pre>{text}</pre>
        <p>Currnet: {currentChar}</p>
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
                <td>{diffs[idx] / 1_000_000_000}</td>
              </tr>
              <tr>
                <th> color </th>
                <td>{colors[idx].map((c) => Math.trunc(c * 255)).join(", ")}</td
                >
              </tr>
            </tbody>
          </table>
          <div>
            <button
              onclick={() =>
                computeChar(dataList[idx], colors[idx], textOnlyImage!)}
            >
              draw
            </button>
            <button
              disabled={currentCandidateIndex <= 0}
              onclick={() => currentCandidateIndex--}
            >
              prev
            </button>
            <button
              disabled={currentCandidateIndex >= dataList.length - 1}
              onclick={() => currentCandidateIndex++}>next</button
            >
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  canvas {
    border: 1px solid black;
    width: 100%;
  }

  .char-canvas {
    width: 200px;
    background-color: #000000;
  }
  .container {
    margin: 0 auto;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 10px;
    width: 80%;
  }
  .canvas-container {
    width: 80%;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
</style>
