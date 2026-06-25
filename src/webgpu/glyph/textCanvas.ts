import Manager from "../../manager";

export interface CharCanvasSettings {
  charSize: number;
  charPadding: number;
  fontFamily: string;
  fontWeight: number;
  textColor: string;
  devicePixelRatio: number;
}

export interface CharCanvasLayout {
  canvasPixelSize: number;
  canvasStyleSize: number;
  font: string;
  textColor: string;
  devicePixelRatio: number;
}

const DEFAULT_SETTINGS: CharCanvasSettings = {
  ...Manager.charCanvasSettings,
  devicePixelRatio: Manager.dpr,
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
