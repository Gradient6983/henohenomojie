import { d, std } from "typegpu";
import Manager from "../manager";

export default async function drawStamp(canvas: HTMLCanvasElement) {
  if (!Manager.stampTexture) return;

  // 관련 변수 선언
  const root = Manager.root;
  const stampView = Manager.stampView;
  const sampler = root.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  // pipeline 생성
  const pipeline = root.createRenderPipeline({
    primitive: { topology: "triangle-list" },
    vertex: ({ $vertexIndex: vid }) => {
      "use gpu";

      // 캔버스 전체를 덮는 사각형 생성
      const positions = [
        d.vec2f(-1.0, -1.0),
        d.vec2f(-1.0, 1.0),
        d.vec2f(1.0, -1.0),
        d.vec2f(1.0, 1.0),
        d.vec2f(-1.0, 1.0),
        d.vec2f(1.0, -1.0),
      ];

      const pos = positions[vid];
      // -1 ~ 1 -> 0 ~ 1, y축 반전
      const uv = d.vec2f((pos.x + 1.0) * 0.5, (1.0 - pos.y) * 0.5);

      return {
        $position: d.vec4f(pos, 0.0, 1.0),
        uv,
      };
    },
    fragment: ({ uv }) => {
      "use gpu";

      // 1. stampView에서 현재 픽셀의 값을 읽어옵니다. (stampTexture는 보통 r 채널만 사용합니다)
      const color = std.textureSample(stampView.$, sampler.$, uv);
      // 배율(Multiplier)을 조절하여 작은 값도 잘 보이게 증폭합니다.
      // 값이 0.01씩 10번 쌓이면 0.1이 되는데, 여기에 10을 곱하면 1.0(가장 붉은색)이 됩니다.
      const displayMultiplier = 5.0;
      // 0.0 ~ 1.0 범위를 넘지 않게 clamp 해줍니다.
      const intensity = std.clamp(color.r * displayMultiplier, 0.0, 1.0);
      let r = 0.0;
      let g = 0.0;
      let b = 0.0;
      // 2. 값(0.0 ~ 1.0)에 따라 색상을 매핑하는 함수를 작성합니다.
      // 0.0 -> 검은색/파란색
      // 0.5 -> 초록색/노란색
      // 1.0 -> 빨간색/흰색 등

      // 간단한 히트맵(Jet-like) 컬러 그라데이션 적용
      if (intensity < 0.25) {
        // Black to Blue
        b = intensity * 4.0;
      } else if (intensity < 0.5) {
        // Blue to Cyan
        g = (intensity - 0.25) * 4.0;
        b = 1.0;
      } else if (intensity < 0.75) {
        // Cyan to Yellow
        r = (intensity - 0.5) * 4.0;
        g = 1.0;
        b = 1.0 - (intensity - 0.5) * 4.0;
      } else {
        // Yellow to Red
        r = 1.0;
        g = 1.0 - (intensity - 0.75) * 4.0;
      }
      // 3. 변환된 색상을 반환합니다. alpha는 1.0으로 고정합니다.
      return d.vec4f(r, g, b, 1.0);
    },
  });

  // alpha mode를 premultiplied로 설정하면 alpha blending이 자동으로 됨
  const context = root.configureContext({ canvas, alphaMode: "premultiplied" });
  pipeline
    .withColorAttachment({
      view: context,
    })
    .draw(6);
}
