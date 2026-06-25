import { d, std } from "typegpu";
import Manager from "../manager";
import type { CharPos, Color } from "../type";
import { createGpuCandidate, gpuCandidateStruct } from "./gpuUtils";

/**
 * 글자가 그려진 텍스처를 생성하고, 그 텍스처를 캔버스에 그리는 함수
 * @param charPos 글자 위치 데이터
 * @param color 글자 색상
 * @param evolutionCanvas 글자를 그릴 캔버스
 * @returns
 */
export default async function computeChar(
  charPos: CharPos,
  color: Color,
  evolutionCanvas: HTMLCanvasElement,
) {
  const root = Manager.root;
  const canvasWidth = Manager.canvasWidth;
  const canvasHeight = Manager.canvasHeight;
  const { stampGain } = Manager.scoringConfig;

  const sampler = root.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  const diffTex = Manager.differenceTexture;
  const diffView = Manager.differenceView;
  const charTex = Manager.charTexture;
  const charView = Manager.charView;

  if (!diffTex || !charTex) return;

  const charPosBuffer = root.createUniform(gpuCandidateStruct, {
    ...createGpuCandidate(charPos),
    color: d.vec3f(color[0], color[1], color[2]),
  });

  const tex = root
    .createTexture({
      size: [canvasWidth, canvasHeight],
      format: "rgba16float" as const,
    })
    .$usage("sampled")
    .$usage("storage");
  const view = tex.createView(d.texture2d(d.f32));
  const sampledView = tex.createView(d.textureStorage2d("rgba16float"));
  const stampTex = Manager.stampTexture.$usage("sampled").$usage("storage");
  const stampView = stampTex.createView(d.texture2d(d.f32));
  // 쓰기용으로 사용할 새로운 텍스처 생성
  const newStampTex = root
    .createTexture({
      size: [canvasWidth, canvasHeight],
      format: "rgba16float" as const,
    })
    .$usage("sampled")
    .$usage("storage");
  const newStampView = newStampTex.createView(d.texture2d(d.f32));
  const stampStoreView = newStampTex.createView(
    d.textureStorage2d("rgba16float"),
  );

  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    // 가장 흔한 방식은 textureLoad로 읽어오고, textureStore로 저장하는 방식
    const diffTexColor = std.textureLoad(diffView.$, xy, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);

    const charMaxX = d.f32(charTexDimension.x) / d.f32(2.0);
    const charMaxY = d.f32(charTexDimension.y) / d.f32(2.0);
    const charMinX = -charMaxX;
    const charMinY = -charMaxY;

    // 일단 가장 첫번째 요소만 읽어옴
    const charPos = charPosBuffer.$;
    // 픽셀의 해당 좌표가 char texture의 어느 부분에 들어가는지 계산하기
    const pixelPos = charPos.transform.mul(d.vec3f(d.f32(xy.x), d.f32(xy.y), d.f32(1.0)));

    const xCondition = pixelPos.x >= charMinX && pixelPos.x <= charMaxX;
    const yCondition = pixelPos.y >= charMinY && pixelPos.y <= charMaxY;
    if (!xCondition || !yCondition) {
      std.textureStore(sampledView.$, xy, diffTexColor);
      // 기존 값을 그대로 복사
      const prevStamp = std.textureLoad(stampView.$, xy, 0).r;
      std.textureStore(stampStoreView.$, xy, d.vec4f(prevStamp, d.f32(0.0), d.f32(0.0), d.f32(1.0)));
    } else {
      const charX = d.u32(pixelPos.x - charMinX);
      const charY = d.u32(pixelPos.y - charMinY);
      const charXy = d.vec2u(charX, charY);
      const charTex = std.textureLoad(charView.$, charXy, 0);
      const charRgb = charPos.color;
      const charAlpha = charTex.a * charPos.opacity;
      const blendedRgb = std.mix(diffTexColor.rgb, charRgb, charAlpha);
      const blended = d.vec4f(
        blendedRgb,
        diffTexColor.a + charTex.a * charPos.opacity,
      );
      std.textureStore(sampledView.$, xy, blended);
      // stamp texture에 대해서도 업데이트 진행
      const prevStamp = std.textureLoad(stampView.$, xy, 0).r;
      const nextStamp = std.clamp(
        prevStamp + charAlpha * d.f32(stampGain),
        d.f32(0.0),
        d.f32(1.0),
      );
      std.textureStore(stampStoreView.$, xy, d.vec4f(nextStamp, d.f32(0.0), d.f32(0.0), d.f32(1.0)));
    }
  });

  program.dispatchThreads(canvasWidth, canvasHeight);

  // 최상위 랭킹의 글자 데이터의 위치를 텍스처에 반영
  Manager.differenceTexture = tex;
  Manager.differenceView = view;

  Manager.stampTexture = newStampTex;
  Manager.stampView = newStampView;

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

      // const color = std.textureSample(view.$, sampler.$, uv);
      const color = std.textureSample(Manager.differenceView.$, sampler.$, uv);
      return color;
    },
  });

  // alpha mode를 premultiplied로 설정하면 alpha blending이 자동으로 됨
  const context = root.configureContext({
    canvas: evolutionCanvas,
    alphaMode: "premultiplied",
  });
  pipeline
    .withColorAttachment({
      view: context,
    })
    .draw(6);
}
