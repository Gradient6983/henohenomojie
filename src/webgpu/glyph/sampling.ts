// Sampling utilities that randomly generate/mutate character position candidates (CharPos).
// Used by the character position search (glyphComputeWorkflow) to build the candidate pool.

import type { CharPos, CharPosRange } from "../../types/geometry";
import { clamp, randomInRange } from "../../util/math";

function clampToRange(value: number, range: { min: number; max: number }) {
  return clamp(value, range.min, range.max);
}

export function createRandomDataList(
  range: CharPosRange,
  num: number,
  clip: CharPosRange,
): CharPos[] {
  const { x, y, scale, opacity, rotation } = range;
  const {
    x: xClip,
    y: yClip,
    scale: scaleClip,
    opacity: opacityClip,
    rotation: rotationClip,
  } = clip;
  return Array.from({ length: num }, () => ({
    x: clampToRange(randomInRange(x.min, x.max), xClip),
    y: clampToRange(randomInRange(y.min, y.max), yClip),
    scale: clampToRange(randomInRange(scale.min, scale.max), scaleClip),
    opacity: clampToRange(randomInRange(opacity.min, opacity.max), opacityClip),
    rotation: clampToRange(
      randomInRange(rotation.min, rotation.max),
      rotationClip,
    ),
  }));
}

/**
 * Generates new character position data by applying a degree of variance to the original data.
 * @param data Original character position data
 * @param length Number of character position entries to generate
 * @param variance Degree of variance (0~1)
 * @returns Array of character position data with the variance applied
 */
export function addRandomVariance(
  data: CharPos,
  length: number,
  variance: number,
  clip: CharPosRange,
): CharPos[] {
  // TODO: We probably need to clip against the given original initial values or other values.
  // Otherwise, values like scale keep growing larger over time.
  const { x, y, scale, opacity, rotation } = data;
  const {
    x: xClip,
    y: yClip,
    scale: scaleClip,
    opacity: opacityClip,
    rotation: rotationClip,
  } = clip;

  // Since the angle ranges from 0~360 degrees by default, multiply by 360 to compute the variance
  const rotationVariance = 360 * variance;
  // Likewise, since scale will range between 0.1~5 by default, multiply by 5
  // These are temporary values and may be adjusted later
  const scaleVariance = 5 * variance;
  return Array.from({ length }, () => ({
    x: clampToRange(x + randomInRange(-variance, variance), xClip),
    y: clampToRange(y + randomInRange(-variance, variance), yClip),
    scale: clampToRange(
      scale + randomInRange(-scaleVariance, scaleVariance),
      scaleClip,
    ),
    opacity: clampToRange(opacity + randomInRange(-variance, variance), opacityClip),
    rotation: clampToRange(
      rotation + randomInRange(-rotationVariance, rotationVariance),
      rotationClip,
    ),
  }));
}
