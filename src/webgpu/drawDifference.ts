import { d, std } from "typegpu";
import Manager from "../manager";

export async function drawDifference(canvas: HTMLCanvasElement) {
  const canvasWidth = Manager.canvasWidth;
  const canvasHeight = Manager.canvasHeight;
  if (canvasWidth === 0 || canvasHeight === 0) return;

  const root = Manager.root;

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

      const texColor = std.textureSample(Manager.imageView.$, sampler.$, uv);
      const differenceColor = std.textureSample(
        Manager.differenceView.$,
        sampler.$,
        uv,
      );
      // 원본 이미지와 difference의 차이가 클수록 histogram형태로 색을 표시하기
      const dist = std.distance(texColor.rgb, differenceColor.rgb);
      const t = dist / 1.732;
      const r = t * 3.0;
      const g = t * 3.0 - 1.0;
      const b = t * 3.0 - 2.0;
      return d.vec4f(
        std.clamp(r, 0.0, 1.0),
        std.clamp(g, 0.0, 1.0),
        std.clamp(b, 0.0, 1.0),
        1.0,
      );
      // return d.vec4f(1.0, 0.0, 0.0, 1.0);
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
