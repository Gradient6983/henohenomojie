// Training progress status and training result types.

import type { SongCatalogItem } from "./song";

/** Progress phase of the training pipeline. */
export type TrainPhase =
  | "preparing"
  | "extracting"
  | "training"
  | "finalizing"
  | "done"
  | "cancelled"
  | "error";

export interface TrainedResult {
  /** Song info used for playback. imageUrl is overwritten with the uploaded/normalized image. */
  song: SongCatalogItem;
  /** Raw jsonl string read by GlyphPlayer */
  jsonlRaw: string;
  /** Sobel edge overlay image URL (data URL) */
  edgeUrl?: string;
}
