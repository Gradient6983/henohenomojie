import type { DataList } from "./util";

export function drawDiffDebug(
  canvas: HTMLCanvasElement,
  color: [number, number, number],
  data: DataList,
) {
  // 1. 일단 debug canvas 텍스처를 불러옴
  // 2. 그런 다음에 위치와 색 데이터를 기반으로 char texture를 debug canvas에 그림
  // 3. 그리고 기존 이미지와의 char이 그려진 이미지와의 차이를 계산함
  // 4. 계산 결과를 histogram형태로 그림
  // 5. 그리고 기존 debug canvas의 차이와 글자가 있을때 debug canvas의 차이를 계산해서 수치화 하기
  // 6. 만약 가능하다면 debug canvas도 글자가 있는 형태로 업데이트하기
}
