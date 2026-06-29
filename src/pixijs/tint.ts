// Helper for converting 0-1 RGB colors into a PixiJS tint (0xRRGGBB).

import type { Color } from "../types/geometry";
import { hslToTint, rgbToHsl } from "../util/color";

/** Converts 0-1 RGB directly to a 0xRRGGBB tint. */
export function makeTint(rgb: Color): number {
  const r = Math.min(255, Math.max(0, Math.round(rgb[0] * 255)));
  const g = Math.min(255, Math.max(0, Math.round(rgb[1] * 255)));
  const b = Math.min(255, Math.max(0, Math.round(rgb[2] * 255)));
  return (r << 16) | (g << 8) | b;
}

/**
 * Creates a "spark color" derived from the character color but with boosted saturation.
 * In exclusion blending, brighter colors produce a stronger difference (inversion) against
 * the background, so the lightness is set somewhat high.
 * If the character is nearly achromatic, it falls back to gold (45°) to avoid a dull white.
 */
export function makeSparkTint(rgb: Color): number {
  const { h, s } = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const baseHue = s < 0.2 ? 45 : h;
  const hue = (baseHue + (Math.random() - 0.5) * 30 + 360) % 360;
  const sat = Math.min(1, Math.max(0.9, s));
  const light = 0.6 + (Math.random() - 0.5) * 0.12;
  return hslToTint(hue, sat, light);
}
