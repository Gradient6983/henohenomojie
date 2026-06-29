// Basic geometry types used for glyph placement and color computation.

export interface MinMax {
  min: number;
  max: number;
}

/** Placement info for a single glyph (normalized coords 0-1, scale/opacity/rotation). */
export interface CharPos {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
}

/** The allowed value range for each CharPos field. Used for candidate generation and clipping. */
export interface CharPosRange {
  x: MinMax;
  y: MinMax;
  scale: MinMax;
  opacity: MinMax;
  rotation: MinMax;
}

/** RGB color. The range (0-1 or 0-255) depends on the usage. */
export type Color = [number, number, number];
