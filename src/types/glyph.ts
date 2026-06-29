// Types related to the glyph position search (compute) workflow and glyph canvas rendering.

import type { CharPos, Color } from "./geometry";

export interface GlyphComputeSnapshot {
  currentChar: string;
  currentIndex: number;
  currentDisplayCharIndex: number;
  dataList: CharPos[];
  colors: Color[];
  diffs: number[];
  diffRanks: number[];
}

export interface GlyphStepResult {
  step: number;
  char: string;
  pos: CharPos;
  color: Color;
  diff: number;
}

export interface GlyphProgress {
  /** Index of the glyph currently being trained (0-based) */
  charIndex: number;
  /** Total number of glyphs to render */
  totalChars: number;
  /** Number of epochs completed for the current glyph (1-based) */
  epoch: number;
  /** Total number of epochs per glyph */
  epochNum: number;
  /** Overall progress between 0 and 1 (subdivided by glyph + epoch) */
  fraction: number;
}

export interface GlyphComputeOptions {
  processedText: string[];
  startIndex: number;
  charCanvas: HTMLCanvasElement;
  textOnlyImage: HTMLCanvasElement;
  renderChar: (char: string) => void;
  onUpdate?: (snapshot: GlyphComputeSnapshot) => void;
  onStepResult?: (result: GlyphStepResult) => void;
  /** Progress callback invoked on each epoch */
  onProgress?: (progress: GlyphProgress) => void;
  /** Signal for cancelling during training. When aborted, the loop exits as soon as possible. */
  signal?: AbortSignal;
}

// --- Glyph canvas (text rendering) ---

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
