import Manager from "./manager";
import type { MinMax, CharPos, CharPosRange, Color } from "./type";

/**
 * 이미지의 평균 색상으로 배경을 채운 canvas를 반환하는 함수수
 * @returns 배경을 채울 때 사용할 canvas
 */
export function getFilledCanvas(): HTMLCanvasElement {
  const image = Manager.image;
  const w = Manager.canvasWidth;
  const h = Manager.canvasHeight;
  if (!image)
    throw new Error("[getAverageImageColor] No image in Manager class");

  const canvas = document.createElement("canvas")!;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[getAverageImageColor] No context from canvas");

  ctx.drawImage(image, 0, 0, w, h);
  const imageData = ctx?.getImageData(0, 0, w, h);
  if (!imageData)
    throw new Error("[getAverageImageColor] No image data from canvas");

  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < w * h; i += 4) {
    r += imageData.data[i];
    g += imageData.data[i + 1];
    b += imageData.data[i + 2];
  }

  const count = w * h;
  r = r / count;
  g = g / count;
  b = b / count;

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

function getRandomNumber(range: MinMax): number {
  return Math.random() * (range.max - range.min) + range.min;
}

function clipNumber(number: number, range: MinMax): number {
  return Math.max(range.min, Math.min(range.max, number));
}

export function createRandomDataList(
  range: CharPosRange,
  num: number,
  clip: CharPosRange,
): CharPos[] {
  const { x, y, scale, opacity, rotation } = range;
  const {
    x: xClip,
    y: yClip,
    scale: scaleClip,
    opacity: opacityClip,
    rotation: rotationClip,
  } = clip;
  return Array.from({ length: num }, (_, _i) => ({
    x: clipNumber(getRandomNumber(x), xClip),
    y: clipNumber(getRandomNumber(y), yClip),
    scale: clipNumber(getRandomNumber(scale), scaleClip),
    opacity: clipNumber(getRandomNumber(opacity), opacityClip),
    rotation: clipNumber(getRandomNumber(rotation), rotationClip),
  }));
}

/**
 * 원본 글자 위치 데이터에 변동 정도를 적용하여 새로운 글자 위치 데이터를 생성하는 함수
 * @param data 원본 글자 위치 데이터
 * @param length 생성할 글자 위치 데이터의 개수
 * @param variance 변동 정도 (0~1)
 * @returns 변동 정도를 적용한 글자 위치 데이터 배열
 */
export function addRandomVariance(
  data: CharPos,
  length: number,
  variance: number,
  clip: CharPosRange,
): CharPos[] {
  // TODO: 주어진 원래 초기값이나, 다른 값들에 대해서 clip을 해야할 듯
  // 안 그러면 시간이 지날수록 크기 같은 경우에는 값이 점점 커짐
  const { x, y, scale, opacity, rotation } = data;
  const {
    x: xClip,
    y: yClip,
    scale: scaleClip,
    opacity: opacityClip,
    rotation: rotationClip,
  } = clip;

  // 각도는 기본이 0~360도이기에 360을 곱해서 변동 정도를 계산
  const rotationVariance = 360 * variance;
  // 마찬가지로 크기는 기본이 0.1~5사이에서 움직일 예정이기에 5를 곱함
  // 이는 임시적인 수치이기에 추후에 수정될 수 있음
  const scaleVariance = 5 * variance;
  return Array.from({ length }, (_, _i) => ({
    x:
      x + clipNumber(getRandomNumber({ min: -variance, max: variance }), xClip),
    y:
      y + clipNumber(getRandomNumber({ min: -variance, max: variance }), yClip),
    scale:
      scale +
      clipNumber(
        getRandomNumber({ min: -scaleVariance, max: scaleVariance }),
        scaleClip,
      ),
    opacity:
      opacity +
      clipNumber(
        getRandomNumber({ min: -variance, max: variance }),
        opacityClip,
      ),
    rotation:
      rotation +
      clipNumber(
        getRandomNumber({ min: -rotationVariance, max: rotationVariance }),
        rotationClip,
      ),
  }));
}

export function updateCanvasSize(canvas: HTMLCanvasElement) {
  const dpr = Manager.dpr;
  if (!Manager.image) return;
  const image = Manager.image;
  const canvasWidth = image.width * dpr;
  const canvasHeight = image.height * dpr;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = "100%";
  Manager.canvasWidth = canvasWidth;
  Manager.canvasHeight = canvasHeight;
}
