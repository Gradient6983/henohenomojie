// App-wide settings. Being module-level $state, every component reads the same shared value,
// and when the value changes, all components reading it update automatically.
// (Same pattern as the trainedStore / locale stores)

import { clamp } from "../util/math";

// Volume 0-100 (same range as TextAlive Player.volume)
let volume = $state(80);
// Edge (Sobel edge) overlay opacity 0-1
let edgeOpacity = $state(0.1);
// Whether to show the edge overlay
let showEdges = $state(true);
// Constellation (lyric-glyph connecting lines) mode on/off
let constellation = $state(false);

export function getVolume(): number {
  return volume;
}

export function setVolume(next: number): void {
  volume = clamp(Math.round(next), 0, 100);
}

export function getEdgeOpacity(): number {
  return edgeOpacity;
}

export function setEdgeOpacity(next: number): void {
  edgeOpacity = clamp(next, 0, 1);
}

export function getShowEdges(): boolean {
  return showEdges;
}

export function setShowEdges(next: boolean): void {
  showEdges = next;
}

export function getConstellation(): boolean {
  return constellation;
}

export function setConstellation(next: boolean): void {
  constellation = next;
}
