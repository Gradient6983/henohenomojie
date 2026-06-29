// Serializes the extracted lyrics bundle and character placement results into a JSONL (NDJSON) string.

import type { GlyphStepResult } from "../types/glyph";
import type {
  CharRecord,
  PlacementRecord,
  SongJsonlRecord,
  SongLyricsBundle,
} from "../types/song";

export function buildPlacementRecords(
  songId: string,
  chars: CharRecord[],
  results: GlyphStepResult[],
): PlacementRecord[] {
  const renderableChars = chars.filter((char) => char.isRenderable);
  const placements: PlacementRecord[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const mappedChar = renderableChars[i];
    if (!mappedChar) continue;

    placements.push({
      type: "placement",
      songId,
      charId: mappedChar.charId,
      step: result.step,
      char: result.char,
      pos: result.pos,
      color: result.color,
      diff: result.diff,
    });
  }

  return placements;
}

export function toSongJsonl(
  bundle: SongLyricsBundle,
  placements: PlacementRecord[] = [],
): string {
  const lines: SongJsonlRecord[] = [
    bundle.song,
    ...bundle.phrases,
    ...bundle.words,
    ...bundle.chars,
    ...placements,
  ];
  return lines.map((line) => JSON.stringify(line)).join("\n");
}
