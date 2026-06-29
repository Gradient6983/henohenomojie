// PixiJS texture creation helpers (character texture, spark texture).

import * as PIXI from "pixi.js";
import type { CharCanvasLayout } from "../types/glyph";
import { drawCenteredChar } from "../util/textCanvas";

/** Builds a PixiJS texture from a canvas with the given character drawn in white (so it can be colored via tint). */
export function createCharTexture(
  char: string,
  layout: CharCanvasLayout,
): PIXI.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasPixelSize;
  canvas.height = layout.canvasPixelSize;
  drawCenteredChar(canvas, char, layout);
  return PIXI.Texture.from(canvas);
}

/** Creates a soft circular spark texture that is bright in the center and transparent at the edges. */
export function createSparkTexture(): PIXI.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  return PIXI.Texture.from(canvas);
}
