import { d, std } from "typegpu";
import Manager from "../manager";

export default async function drawImage(canvas: HTMLCanvasElement) {
  if (!Manager.image) return;

  // 관련 변수 선언
  const root = Manager.root;
  const imageView = Manager.imageView;
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

      const color = std.textureSample(imageView.$, sampler.$, uv);
      return color;
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
