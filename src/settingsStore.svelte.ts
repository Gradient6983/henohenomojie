// 앱 전역 설정. 모듈 수준 $state라 어느 컴포넌트에서 읽어도 같은 값을 공유하고,
// 값이 바뀌면 이 값을 읽는 모든 컴포넌트가 자동으로 갱신된다.
// (trainedStore / locale 스토어와 동일한 패턴)

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

// 음량 0-100 (TextAlive Player.volume과 동일한 범위)
let volume = $state(80);
// 윤곽선(Sobel edge) 오버레이 투명도 0-1
let edgeOpacity = $state(0.1);
// 윤곽선 오버레이 표시 여부
let showEdges = $state(true);
// 별자리(가사 글자 연결선) 모드 on/off
let constellation = $state(false);

export function getVolume(): number {
  return volume;
}

export function setVolume(next: number): void {
  volume = clamp(0, 100, Math.round(next));
}

export function getEdgeOpacity(): number {
  return edgeOpacity;
}

export function setEdgeOpacity(next: number): void {
  edgeOpacity = clamp(0, 1, next);
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
