import Manager from "./manager";

interface minmax {
  min: number;
  max: number;
}

export interface DataList {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
}

export function createRandomDataList({
  x, // 0~1(상대좌표)
  y, // 0~1(상대좌표)
  scale, // 0~1?(상대좌표)
  opacity, // 0~1(상대좌표)
  rotation, // 0~360(도)
  num, // 개수
}: {
  x: minmax;
  y: minmax;
  scale: minmax;
  opacity: minmax;
  rotation: minmax;
  num: number;
}): DataList[] {
  return Array.from({ length: num }, (_, i) => ({
    x: Math.random() * (x.max - x.min) + x.min,
    y: Math.random() * (y.max - y.min) + y.min,
    scale: Math.random() * (scale.max - scale.min) + scale.min,
    opacity: Math.random() * (opacity.max - opacity.min) + opacity.min,
    rotation: Math.random() * (rotation.max - rotation.min) + rotation.min,
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
