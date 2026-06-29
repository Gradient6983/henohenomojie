// Layout calculation and rendering utilities for drawing characters on a (2D) canvas.
// Shared by both training (WebGPU input canvas) and playback (Pixi texture).

import { CHAR_CANVAS_SETTINGS } from "../const/glyphConfig";
import type { CharCanvasLayout, CharCanvasSettings } from "../types/glyph";

const DEFAULT_SETTINGS: CharCanvasSettings = {
  ...CHAR_CANVAS_SETTINGS,
  devicePixelRatio: window.devicePixelRatio || 1,
};

export function createCharCanvasLayout(
  settings: Partial<CharCanvasSettings> = {},
): CharCanvasLayout {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const canvasStyleSize = Math.ceil(merged.charSize + merged.charPadding * 2);
  const canvasPixelSize = Math.ceil(canvasStyleSize * merged.devicePixelRatio);
  return {
    canvasPixelSize,
    canvasStyleSize,
    font: `${merged.fontWeight} ${merged.charSize}px ${merged.fontFamily}`,
    textColor: merged.textColor,
    devicePixelRatio: merged.devicePixelRatio,
  };
}

export function getRenderableChars(text: string): string[] {
  const emptySpaceRegex = /^\s*$/;
  return text.split("").filter((char) => !emptySpaceRegex.test(char));
}

export function drawCenteredChar(
  canvas: HTMLCanvasElement,
  char: string,
  layout: CharCanvasLayout,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(layout.devicePixelRatio, 0, 0, layout.devicePixelRatio, 0, 0);
  ctx.font = layout.font;
  ctx.fillStyle = layout.textColor;

  const { width, actualBoundingBoxAscent, actualBoundingBoxDescent } =
    ctx.measureText(char);

  const x = layout.canvasStyleSize / 2 - width / 2;
  const y =
    layout.canvasStyleSize / 2 -
    actualBoundingBoxDescent / 2 +
    actualBoundingBoxAscent / 2;

  ctx.clearRect(0, 0, layout.canvasPixelSize, layout.canvasPixelSize);
  ctx.fillText(char, x, y);
}
