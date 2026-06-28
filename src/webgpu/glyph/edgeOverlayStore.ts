export interface EdgeOverlayEntry {
  /** songId(=imageId 매핑) 기준 키 */
  id: string;
  width: number;
  height: number;
  /** PIXI.Texture.from()에 그대로 넘길 수 있는 캔버스 소스 */
  source: HTMLCanvasElement;
}

/**
 * Sobel 윤곽선 결과를 메모리에 보관하는 단순 모듈 싱글톤 스토어.
 * WebGPU 결과(캔버스)를 보관만 하며, 어떤 프레임워크에도 의존하지 않는다.
 * App(편집 화면)에서 채우고, Pixi 프리뷰에서 오버레이 텍스처로 꺼내 쓴다.
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
