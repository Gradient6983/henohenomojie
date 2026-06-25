import type { CharPos, CharPosRange, Color } from "../../type";
import { addRandomVariance, createRandomDataList } from "../../util";
import Manager from "../../manager";
import computeChar from "../computeChar";
import { computeColor } from "../computeColor";
import { debugDifference } from "../debugDifference";

export interface GlyphComputeSnapshot {
  currentChar: string;
  currentIndex: number;
  currentDisplayCharIndex: number;
  dataList: CharPos[];
  colors: Color[];
  diffs: number[];
  diffRanks: number[];
}

export interface GlyphComputeOptions {
  processedText: string[];
  startIndex: number;
  charCanvas: HTMLCanvasElement;
  textOnlyImage: HTMLCanvasElement;
  renderChar: (char: string) => void;
  onUpdate?: (snapshot: GlyphComputeSnapshot) => void;
}

function rankByDifference(diffArray: number[]): number[] {
  const diffWithIdx = diffArray.map((value, index) => ({ value, index }));
  diffWithIdx.sort((a, b) => a.value - b.value);
  return diffWithIdx.map((item) => item.index);
}

function charScaleForStep(
  index: number,
  config: {
    charPosClip: CharPosRange;
    charScaleVariance: number;
  },
) {
  const charMax = config.charPosClip.scale.max;
  const charMin = config.charPosClip.scale.min;
  return (
    (charMax + config.charScaleVariance) * Math.exp(-1.5 * index) +
    charMin +
    config.charScaleVariance
  );
}

export async function runGlyphComputeWorkflow(options: GlyphComputeOptions) {
  const config = Manager.glyphSearchConfig;
  const displayCharNum = options.processedText.length;

  if (displayCharNum === 0) {
    return {
      currentChar: "",
      currentIndex: 0,
      currentDisplayCharIndex: 0,
      dataList: [],
      colors: [],
      diffs: [],
      diffRanks: [],
    } satisfies GlyphComputeSnapshot;
  }

  let currentIndex = options.startIndex;
  let currentDisplayCharIndex = 0;

  const snapshot: GlyphComputeSnapshot = {
    currentChar: options.processedText[currentIndex] ?? options.processedText[0],
    currentIndex,
    currentDisplayCharIndex,
    dataList: [],
    colors: [],
    diffs: [],
    diffRanks: [],
  };

  for (let c = 0; c < displayCharNum; c++) {
    const charCurrentScale =
      charScaleForStep(c * 0.02, config) - config.charScaleVariance;
    let diffArray: number[] = [];

    let dataCandidateList: CharPos[] = createRandomDataList(
      {
        x: { min: 0, max: 1 },
        y: { min: 0, max: 1 },
        scale: {
          min: charCurrentScale - config.charScaleVariance,
          max: charCurrentScale + config.charScaleVariance,
        },
        opacity: { min: 0.5, max: 1 },
        rotation: { min: 0, max: 360 },
      },
      config.candidateNum,
      config.charPosClip,
    );

    try {
      for (let i = 0; i < config.epochNum; i++) {
        const sampleAvgColors = await computeColor(
          dataCandidateList,
          options.charCanvas,
        );
        if (!sampleAvgColors) throw new Error("computeColor failed");

        snapshot.colors = sampleAvgColors.map(
          (color) => [color.r, color.g, color.b] as Color,
        );

        const result = await debugDifference(snapshot.colors, dataCandidateList);
        if (!result) throw new Error("debugDifference failed");
        diffArray = result;

        snapshot.diffRanks = rankByDifference(diffArray);
        snapshot.dataList = dataCandidateList;

        const topN: CharPos[] = [];
        for (let rank = 0; rank < config.topCandidateNum; rank++) {
          const idx = snapshot.diffRanks[rank];
          if (idx === undefined) continue;
          topN.push(dataCandidateList[idx]);
        }

        dataCandidateList = [];
        for (const data of topN) {
          const varianceList = addRandomVariance(
            data,
            Math.trunc(config.candidateNum / config.topCandidateNum),
            config.otherVariance,
            config.charPosClip,
          );
          dataCandidateList.push(...varianceList);
        }

        options.onUpdate?.({ ...snapshot });
      }

      snapshot.diffs = diffArray;
      const topIndex = snapshot.diffRanks[0];
      if (topIndex !== undefined) {
        await computeChar(
          snapshot.dataList[topIndex],
          snapshot.colors[topIndex],
          options.textOnlyImage,
        );
      }
    } catch (error) {
      console.error("[compute] 실행 실패:", error);
    }

    currentIndex =
      currentIndex < options.processedText.length - 1 ? currentIndex + 1 : 0;
    snapshot.currentIndex = currentIndex;
    snapshot.currentChar = options.processedText[currentIndex];
    options.renderChar(snapshot.currentChar);
    currentDisplayCharIndex += 1;
    snapshot.currentDisplayCharIndex = currentDisplayCharIndex;

    options.onUpdate?.({ ...snapshot });
  }

  return snapshot;
}
