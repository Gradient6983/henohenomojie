// Time formatting utilities.

/** Converts milliseconds to a "m:ss" formatted string. */
export function formatTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(clamped / 1000);
  const minute = Math.floor(totalSec / 60);
  const second = String(totalSec % 60).padStart(2, "0");
  return `${minute}:${second}`;
}
