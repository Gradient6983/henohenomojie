// Loads song lyrics via the TextAlive App API and extracts them into phrase/word/char records.
// Contains only TextAlive-specific logic, unrelated to WebGPU/rendering.

import type { IChar, IPhrase, IVideo, IWord } from "textalive-app-api";
import { Player } from "textalive-app-api";
import type {
  CharRecord,
  PhraseRecord,
  SongCatalogItem,
  SongLyricsBundle,
  WordRecord,
} from "../types/song";

interface LoadedSongContext {
  player: Player;
  video: IVideo;
}

const SPACES = /^\s*$/;

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function makeCharId(params: {
  songId: string;
  charIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  phraseId: string;
  wordId: string;
}): string {
  const raw = `${params.songId}|${params.charIndex}|${params.text}|${params.startTime}|${params.endTime}|${params.phraseId}|${params.wordId}`;
  return `c:${params.charIndex}:${simpleHash(raw)}`;
}

function isRenderableChar(char: string): boolean {
  return !SPACES.test(char);
}

function loadSongWithPlayer(
  token: string,
  song: SongCatalogItem,
): Promise<LoadedSongContext> {
  return new Promise((resolve, reject) => {
    const player = new Player({
      app: { token },
    });
    let settled = false;

    player.addListener({
      onAppReady() {
        player.createFromSongUrl(
          song.songUrl,
          song.video ? ({ video: song.video } as never) : undefined,
        );
      },
      onVideoReady(video: IVideo) {
        if (settled) return;
        settled = true;
        resolve({ player, video });
      },
      onError(error: unknown) {
        if (settled) return;
        settled = true;
        reject(error);
      },
    });
  });
}

export async function extractSongLyrics(
  token: string,
  song: SongCatalogItem,
): Promise<SongLyricsBundle> {
  const { player, video } = await loadSongWithPlayer(token, song);

  if (!video.firstChar) {
    throw new Error(`[TextAlive] No lyric timing data: ${song.label}`);
  }

  const phraseIdByRef = new WeakMap<object, string>();
  const wordIdByRef = new WeakMap<object, string>();

  const phraseOrder: string[] = [];
  const wordOrder: string[] = [];

  const phraseBuilders = new Map<
    string,
    {
      phraseId: string;
      startTime: number;
      endTime: number;
      charStartIndex: number;
      charEndIndex: number;
      textParts: string[];
    }
  >();

  const wordBuilders = new Map<
    string,
    {
      wordId: string;
      phraseId: string;
      startTime: number;
      endTime: number;
      charStartIndex: number;
      charEndIndex: number;
      textParts: string[];
    }
  >();

  const chars: CharRecord[] = [];

  let char: IChar | null = video.firstChar;
  let charIndex = 0;
  let renderIndex = 0;

  while (char) {
    const wordRef = char.parent as IWord | undefined;
    const phraseRef = wordRef?.parent as IPhrase | undefined;

    if (!wordRef || !phraseRef) {
      char = char.next;
      continue;
    }

    let phraseId = phraseIdByRef.get(phraseRef);
    if (!phraseId) {
      phraseId = `p:${phraseOrder.length}`;
      phraseIdByRef.set(phraseRef, phraseId);
      phraseOrder.push(phraseId);
      phraseBuilders.set(phraseId, {
        phraseId,
        startTime: phraseRef.startTime,
        endTime: phraseRef.endTime,
        charStartIndex: charIndex,
        charEndIndex: charIndex,
        textParts: [],
      });
    }

    let wordId = wordIdByRef.get(wordRef);
    if (!wordId) {
      wordId = `w:${wordOrder.length}`;
      wordIdByRef.set(wordRef, wordId);
      wordOrder.push(wordId);
      wordBuilders.set(wordId, {
        wordId,
        phraseId,
        startTime: wordRef.startTime,
        endTime: wordRef.endTime,
        charStartIndex: charIndex,
        charEndIndex: charIndex,
        textParts: [],
      });
    }

    const renderable = isRenderableChar(char.text);

    chars.push({
      type: "char",
      songId: song.id,
      charId: makeCharId({
        songId: song.id,
        charIndex,
        text: char.text,
        startTime: char.startTime,
        endTime: char.endTime,
        phraseId,
        wordId,
      }),
      phraseId,
      wordId,
      charIndex,
      renderIndex: renderable ? renderIndex : null,
      text: char.text,
      startTime: char.startTime,
      endTime: char.endTime,
      duration: Math.max(char.endTime - char.startTime, 0),
      isRenderable: renderable,
    });

    const phraseBuilder = phraseBuilders.get(phraseId);
    if (phraseBuilder) {
      phraseBuilder.textParts.push(char.text);
      phraseBuilder.charEndIndex = charIndex;
    }

    const wordBuilder = wordBuilders.get(wordId);
    if (wordBuilder) {
      wordBuilder.textParts.push(char.text);
      wordBuilder.charEndIndex = charIndex;
    }

    if (renderable) {
      renderIndex += 1;
    }

    charIndex += 1;
    char = char.next;
  }

  const phrases: PhraseRecord[] = phraseOrder.map((id) => {
    const p = phraseBuilders.get(id);
    if (!p) throw new Error(`[TextAlive] Missing phrase builder: ${id}`);
    return {
      type: "phrase",
      songId: song.id,
      phraseId: p.phraseId,
      text: p.textParts.join(""),
      startTime: p.startTime,
      endTime: p.endTime,
      charStartIndex: p.charStartIndex,
      charEndIndex: p.charEndIndex,
    };
  });

  const words: WordRecord[] = wordOrder.map((id) => {
    const w = wordBuilders.get(id);
    if (!w) throw new Error(`[TextAlive] Missing word builder: ${id}`);
    return {
      type: "word",
      songId: song.id,
      wordId: w.wordId,
      phraseId: w.phraseId,
      text: w.textParts.join(""),
      startTime: w.startTime,
      endTime: w.endTime,
      charStartIndex: w.charStartIndex,
      charEndIndex: w.charEndIndex,
    };
  });

  return {
    song: {
      type: "song",
      version: 1,
      songId: song.id,
      label: song.label,
      songUrl: song.songUrl,
      imageId: song.imageId,
      imageUrl: song.imageUrl,
      title: player.data.song?.name ?? song.label,
      artist: player.data.song?.artist?.name ?? "",
      duration: video.duration ?? 0,
      fullLyrics: chars.map((c) => c.text).join(""),
      createdAt: new Date().toISOString(),
    },
    phrases,
    words,
    chars,
  };
}

export async function extractSongsIndividually(
  token: string,
  songs: SongCatalogItem[],
): Promise<Record<string, SongLyricsBundle>> {
  const result: Record<string, SongLyricsBundle> = {};
  for (const song of songs) {
    result[song.id] = await extractSongLyrics(token, song);
  }
  return result;
}

export function getCharsByPhrase(
  bundle: SongLyricsBundle,
  phraseId: string | null,
): CharRecord[] {
  if (!phraseId) return bundle.chars;
  return bundle.chars.filter((char) => char.phraseId === phraseId);
}
