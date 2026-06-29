import type { EdgeOverlayEntry } from "../types/image";

/**
 * A simple module singleton store that keeps Sobel edge results in memory.
 * It only stores the WebGPU result (canvas) and does not depend on any framework.
 * Filled by App (the editing screen) and pulled out as an overlay texture in the Pixi preview.
 */
const store = new Map<string, EdgeOverlayEntry>();

export function setEdgeOverlay(entry: EdgeOverlayEntry): void {
  store.set(entry.id, entry);
}

export function getEdgeOverlay(id: string): EdgeOverlayEntry | undefined {
  return store.get(id);
}

export function hasEdgeOverlay(id: string): boolean {
  return store.has(id);
}

export function clearEdgeOverlay(id?: string): void {
  if (id === undefined) {
    store.clear();
    return;
  }
  store.delete(id);
}
