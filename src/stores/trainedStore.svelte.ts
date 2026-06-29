import type { TrainedResult } from "../types/train";

// Keeps training results in memory per song id. Reassigns a new object to guarantee reactivity.
let results = $state<Record<string, TrainedResult>>({});

export function setTrainedResult(result: TrainedResult): void {
  results = { ...results, [result.song.id]: result };
}

export function getTrainedResult(id: string): TrainedResult | undefined {
  return results[id];
}

/** Removes the training result to revert to the original (bundled) image/data. */
export function clearTrainedResult(id: string): void {
  if (!(id in results)) return;
  const next = { ...results };
  delete next[id];
  results = next;
}

/** Reactively returns the full map of training results. */
export function getTrainedResults(): Record<string, TrainedResult> {
  return results;
}
