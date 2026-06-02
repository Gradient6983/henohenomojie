import Manager from "./manager";
import type { MinMax, CharPos, CharPosRange } from "./type";

function getRandomNumber(range: MinMax): number {
  return Math.random() * (range.max - range.min) + range.min;
}

export function createRandomDataList(
  range: CharPosRange,
  num: number,
): CharPos[] {
  const { x, y, scale, opacity, rotation } = range;
  return Array.from({ length: num }, (_, _i) => ({
    x: getRandomNumber(x),
    y: getRandomNumber(y),
    scale: getRandomNumber(scale),
    opacity: getRandomNumber(opacity),
    rotation: getRandomNumber(rotation),
  }));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  return new Promise((resolve) => {
    image.onload = () => {
      Manager.image = image;
      resolve(image);
    };
  });
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
