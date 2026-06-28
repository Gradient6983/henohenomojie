import type { SongCatalogItem } from "./webgpu/glyph/replayIO";

export interface TrainedResult {
  /** 재생에 사용할 곡 정보. imageUrl은 업로드/정규화된 이미지로 덮어쓴다. */
  song: SongCatalogItem;
  /** GlyphPlayer가 읽는 jsonl 원본 문자열 */
  jsonlRaw: string;
  /** Sobel 윤곽선 오버레이 이미지 URL(data URL) */
  edgeUrl?: string;
}

// 곡 id별 훈련 결과를 메모리에 보관한다. 새 객체로 재할당해 반응성을 보장한다.
let results = $state<Record<string, TrainedResult>>({});

export function setTrainedResult(result: TrainedResult): void {
  results = { ...results, [result.song.id]: result };
}

export function getTrainedResult(id: string): TrainedResult | undefined {
  return results[id];
}

/** 훈련 결과를 제거해 원래(번들) 이미지/데이터로 되돌린다. */
export function clearTrainedResult(id: string): void {
  if (!(id in results)) return;
  const next = { ...results };
  delete next[id];
  results = next;
}

/** 반응형으로 전체 훈련 결과 맵을 반환한다. */
export function getTrainedResults(): Record<string, TrainedResult> {
  return results;
}
