export interface MinMax {
  min: number;
  max: number;
}

export interface CharPos {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
}

export interface CharPosRange {
  x: MinMax;
  y: MinMax;
  scale: MinMax;
  opacity: MinMax;
  rotation: MinMax;
}

export type Color = [number, number, number];
