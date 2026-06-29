// General-purpose numeric utilities.

/** Clamps `value` to the [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Returns a random number in the [min, max) interval. */
export function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
