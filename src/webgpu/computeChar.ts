import { d, std } from "typegpu";
import Manager from "../manager";
import type { CharPos, Color } from "../type";

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

  const sampler = root.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  const diffTex = Manager.differenceTexture;
  const diffView = Manager.differenceView;
  const charTex = Manager.charTexture;
  const charView = Manager.charView;

  if (!diffTex || !charTex) return;

  const charPosStruct = d.struct({
    x: d.f32,
    y: d.f32,
    scale: d.f32,
    opacity: d.f32,
    rotation: d.f32,
    color: d.vec3f,
  });
  const charPosBuffer = root.createUniform(charPosStruct, {
    ...charPos,
    color: d.vec3f(color[0], color[1], color[2]),
  });

  const tex = root
    .createTexture({
      size: [canvasWidth, canvasHeight],
      format: "rgba8unorm" as const,
    })
    .$usage("sampled")
    .$usage("storage");
  const view = tex.createView(d.texture2d(d.f32));
  const sampledView = tex.createView(d.textureStorage2d("rgba8unorm"));

  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    // 가장 흔한 방식은 textureLoad로 읽어오고, textureStore로 저장하는 방식
    const diffTexColor = std.textureLoad(diffView.$, xy, 0);
    const diffTexDimension = std.textureDimensions(diffView.$, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);

    // 일단 가장 첫번째 요소만 읽어옴
    const charPos = charPosBuffer.$;
    // 픽셀의 해당 좌표가 char texture의 어느 부분에 들어가는지 계산하기

    const scaleMatrix = d.mat3x3f(
      d.vec3f(1 / charPos.scale, 0, 0),
      d.vec3f(0, 1 / charPos.scale, 0),
      d.vec3f(0, 0, 1),
    );
    const rotationRad = (-charPos.rotation * 3.141592) / 180;
    const rotationMatrix = d.mat3x3f(
      d.vec3f(std.cos(rotationRad), std.sin(rotationRad), 0),
      d.vec3f(-std.sin(rotationRad), std.cos(rotationRad), 0),
      d.vec3f(0, 0, 1),
    );
    const transformMatrix = d.mat3x3f(
      d.vec3f(1, 0, 0),
      d.vec3f(0, 1, 0),
      d.vec3f(
        -charPos.x * d.f32(diffTexDimension.x),
        -charPos.y * d.f32(diffTexDimension.y),
        1,
      ),
    );
    const finalMatrix = scaleMatrix.mul(rotationMatrix).mul(transformMatrix);
    const pixelPos = finalMatrix.mul(d.vec3f(d.f32(xy.x), d.f32(xy.y), 1));

    const charMaxX = charTexDimension.x / 2;
    const charMaxY = charTexDimension.y / 2;
    const charMinX = -charMaxX;
    const charMinY = -charMaxY;
    const xCondition = pixelPos.x >= charMinX && pixelPos.x <= charMaxX;
    const yCondition = pixelPos.y >= charMinY && pixelPos.y <= charMaxY;
    if (!xCondition || !yCondition) {
      std.textureStore(sampledView.$, xy, diffTexColor);
    } else {
      const charX = d.u32(pixelPos.x - charMinX);
      const charY = d.u32(pixelPos.y - charMinY);
      const charXy = d.vec2u(charX, charY);
      const charTex = std.textureLoad(charView.$, charXy, 0);
      const charRgb = charPosBuffer.$.color.rgb;
      const charAlpha = charTex.a * charPos.opacity;
      const blendedRgb = std.mix(diffTexColor.rgb, charRgb, charAlpha);
      const blended = d.vec4f(
        blendedRgb,
        diffTexColor.a + charTex.a * charPos.opacity,
      );
      std.textureStore(sampledView.$, xy, blended);
    }
  });

  program.dispatchThreads(canvasWidth, canvasHeight);

  // 원래는 최상위 랭킹의 글자 데이터의 위치를 텍스처에 반영하는게 이 함수의 의도이므로
  // 여기에서 바로 텍스처를 저장하는게 나음
  // TODO: 디버깅용으로 캔버스에 그리는 건 추후에 다른 함수로 빼기
  Manager.differenceTexture = tex;
  Manager.differenceView = view;

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
