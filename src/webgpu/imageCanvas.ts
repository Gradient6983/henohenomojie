import Manager from "../manager";
import type { Color } from "../types/geometry";

/**
 * Returns a canvas whose background is filled with the image's average color.
 * @param color Color used to fill the background. If omitted, the image's average color is used.
 * @returns The canvas to use for filling the background
 */
export function getFilledCanvas(color?: Color): HTMLCanvasElement {
  const image = Manager.image;
  const w = Manager.canvasWidth;
  const h = Manager.canvasHeight;
  if (!image)
    throw new Error("[getFilledCanvas] No image in Manager class");

  const canvas = document.createElement("canvas")!;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[getFilledCanvas] No context from canvas");

  let r = 0,
    g = 0,
    b = 0;

  if (!color) {
    ctx.drawImage(image, 0, 0, w, h);
    const imageData = ctx?.getImageData(0, 0, w, h);
    if (!imageData)
      throw new Error("[getFilledCanvas] No image data from canvas");

    for (let i = 0; i < w * h; i += 4) {
      r += imageData.data[i];
      g += imageData.data[i + 1];
      b += imageData.data[i + 2];
    }

    const count = w * h;
    r = r / count;
    g = g / count;
    b = b / count;
  } else {
    r = color[0];
    g = color[1];
    b = color[2];
  }

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}
