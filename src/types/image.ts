// Types related to image post-processing (Sobel edges) and the edge overlay store.

export interface SobelEdgeResult {
  width: number;
  height: number;
  /**
   * RGBA8 pixel data. Composed of black (0,0,0) edges plus alpha (edge strength).
   * Can be used directly as Canvas ImageData or a PixiJS texture source.
   */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

export interface SobelOptions {
  /** Between 0 and 1. Edges weaker than this are removed to reduce noise. Default 0.2 */
  threshold?: number;
}

export interface EdgeOverlayEntry {
  /** Key based on songId (mapped to imageId) */
  id: string;
  width: number;
  height: number;
  /** Canvas source that can be passed directly to PIXI.Texture.from() */
  source: HTMLCanvasElement;
}
