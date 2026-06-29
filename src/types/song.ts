// Song catalog and jsonl (NDJSON) record types.
// Gathers in one place the song-related types shared by extraction (replayIO), playback (GlyphPlayer), and the UI.

import type { CharPos, Color } from "./geometry";

/** A single song catalog entry (song URL / image / TextAlive video ID). */
export interface SongCatalogItem {
  id: string;
  label: string;
  songUrl: string;
  imageId: string;
  imageUrl: string;
  video?: Record<string, number>;
}

export interface SongRecord {
  type: "song";
  version: 1;
  songId: string;
  label: string;
  songUrl: string;
  imageId: string;
  imageUrl: string;
  title: string;
  artist: string;
  duration: number;
  fullLyrics: string;
  createdAt: string;
}

export interface PhraseRecord {
  type: "phrase";
  songId: string;
  phraseId: string;
  text: string;
  startTime: number;
  endTime: number;
  charStartIndex: number;
  charEndIndex: number;
}

export interface WordRecord {
  type: "word";
  songId: string;
  wordId: string;
  phraseId: string;
  text: string;
  startTime: number;
  endTime: number;
  charStartIndex: number;
  charEndIndex: number;
}

export interface CharRecord {
  type: "char";
  songId: string;
  charId: string;
  phraseId: string;
  wordId: string;
  charIndex: number;
  renderIndex: number | null;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  isRenderable: boolean;
}

export interface PlacementRecord {
  type: "placement";
  songId: string;
  charId: string;
  step: number;
  char: string;
  pos: CharPos;
  color: Color;
  diff: number;
}

export type SongJsonlRecord =
  | SongRecord
  | PhraseRecord
  | WordRecord
  | CharRecord
  | PlacementRecord;

export interface SongLyricsBundle {
  song: SongRecord;
  phrases: PhraseRecord[];
  words: WordRecord[];
  chars: CharRecord[];
}

// --- View types used by the playback screen (GlyphPlayer) after parsing the jsonl ---
// Since only a subset of the canonical records above is read, these are derived with Pick to avoid duplicate definitions.

export type PlayerSongRecord = Pick<SongRecord, "type" | "songUrl"> & {
  duration?: number;
};

export type PlayerCharRecord = Pick<
  CharRecord,
  "type" | "charId" | "startTime" | "phraseId"
>;

export type PlayerPlacementRecord = Pick<
  PlacementRecord,
  "type" | "charId" | "step" | "char" | "pos" | "color"
>;

export type TimedPlacementRecord = PlayerPlacementRecord & {
  startTime: number;
  phraseId: string;
};

export interface PhraseLine {
  phraseId: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface ParsedJsonlData {
  song: PlayerSongRecord | null;
  timedPlacements: TimedPlacementRecord[];
  phrases: PhraseLine[];
}
