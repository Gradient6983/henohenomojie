// Fixed configuration values used for WebGPU glyph placement and scoring.
// Manager exposes them as static fields, but since they are effectively immutable constants, they are gathered here.

import type { CharPosRange } from "../types/geometry";

/** Format used for all textures. */
export const TEXTURE_FORMAT = "rgba16float" as const;

/** Sampler setting that reads pixels directly without interpolation. */
export const NEAREST_SAMPLER_DESCRIPTOR = {
  magFilter: "nearest" as const,
  minFilter: "nearest" as const,
};

/** Default settings for the glyph canvas (text rasterization). */
export const CHAR_CANVAS_SETTINGS = {
  charSize: 960,
  charPadding: 10,
  fontFamily: "Pretendard JP Variable",
  fontWeight: 700,
  textColor: "rgb(0, 0, 0)",
} as const;

/** Parameters for glyph position search (candidate generation/evolution). */
export const GLYPH_SEARCH_CONFIG = {
  candidateNum: 2000,
  epochNum: 10,
  topCandidateNum: 50,
  charPosClip: {
    x: { min: 0, max: 1 },
    y: { min: 0, max: 1 },
    scale: { min: 0.01, max: 1.5 },
    opacity: { min: 0.2, max: 1 },
    rotation: { min: 0, max: 360 },
  } as CharPosRange,
  charScaleVariance: 0.01,
  otherVariance: 0.01,
  scaleStepFactor: 0.02,
  scaleDecayFactor: 1.5,
} as const;

/** Parameters for diff computation and stamp-accumulation scoring. */
export const SCORING_CONFIG = {
  alphaThreshold: 0.01,
  stampOccK: 0.2,
  stampGain: 0.02,
  scoreFactor: 4096,
  colorNormDenominator: 1.732,
  colorNormMax: 255,
  invalidPenalty: 1e9,
} as const;
