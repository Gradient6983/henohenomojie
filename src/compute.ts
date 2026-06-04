import { d, std } from "typegpu";
import Manager from "./manager";

type DataList = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
}[];

export async function execute(
  dataList: DataList,
  debugCanvas: HTMLCanvasElement,
  charCanvas: HTMLCanvasElement,
) {
  if (!Manager.bgTexture) {
    console.warn(
      "[compute] 배경 텍스처가 아직 없습니다. 메인 캔버스 이미지가 로드된 뒤에 compute를 눌러주세요.",
    );
    return;
  }

  // 초기화
  const root = Manager.root;

  // struct 생성
  const data = d.struct({
    x: d.f32,
    y: d.f32,
    scale: d.f32,
    opacity: d.f32,
    rotation: d.f32,
  });

  // storage buffer 생성
  const candidateBuffer = root.createReadonly(d.arrayOf(data, dataList.length));
  candidateBuffer.write(dataList);

  // const candidateFitness = root.createMutable(d.arrayOf(d.f32, viewX * viewY));

  const view = Manager.bgView;
  const viewSize = [Manager.canvasWidth, Manager.canvasHeight] as const;

  // char texture 생성 (diffDebug 등에서 Manager로 재사용)
  const charTexture = root
    .createTexture({
      size: [charCanvas.width, charCanvas.height],
      format: "rgba8unorm" as const,
    })
    .$usage("sampled")
    .$usage("storage");
  charTexture.write(charCanvas);

  const charView = charTexture.createView(d.texture2d(d.f32));
  Manager.charTexture = charTexture;
  Manager.charView = charView;

  // 어떤 식으로든 이미지를 생성하는건 상관없음
  // 그냥 이미지를 storage용으로 생성하고, 그걸 textureStorage2d view로 보면 됨
  const editedImage = root
    .createTexture({
      size: viewSize,
      format: "rgba8unorm" as const,
    })
    .$usage("sampled")
    .$usage("storage");

  const editedImageView = editedImage.createView(
    d.textureStorage2d("rgba8unorm"),
  );
  const editedImageSampledView = editedImage.createView(d.texture2d(d.f32));

  const sampler = root.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  const avgColor = d.struct({
    r: d.atomic(d.u32),
    g: d.atomic(d.u32),
    b: d.atomic(d.u32),
    count: d.atomic(d.u32),
  });

  const avgColorBuffer = root.createMutable(
    d.arrayOf(avgColor, dataList.length),
  );


  // gpu에서 실행되는 프로그램 생성
  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    // 가장 흔한 방식은 textureLoad로 읽어오고, textureStore로 저장하는 방식
    const tex = std.textureLoad(view.$, xy, 0);
    const texDimension = std.textureDimensions(view.$, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);

    // read candidate buffer
    // 일단 가장 첫번째 요소만 읽어옴
    const candidate = candidateBuffer.$[0];
    // 픽셀의 해당 좌표가 char texture의 어느 부분에 들어가는지 계산하기

    const scaleMatrix = d.mat3x3f(
      d.vec3f(1 / candidate.scale, 0, 0),
      d.vec3f(0, 1 / candidate.scale, 0),
      d.vec3f(0, 0, 1),
    );
    const rotationRad = (-candidate.rotation * 3.141592) / 180;
    const rotationMatrix = d.mat3x3f(
      d.vec3f(std.cos(rotationRad), std.sin(rotationRad), 0),
      d.vec3f(-std.sin(rotationRad), std.cos(rotationRad), 0),
      d.vec3f(0, 0, 1),
    );
    const transformMatrix = d.mat3x3f(
      d.vec3f(1, 0, 0),
      d.vec3f(0, 1, 0),
      d.vec3f(
        -candidate.x * d.f32(texDimension.x),
        -candidate.y * d.f32(texDimension.y),
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
      std.textureStore(editedImageView.$, xy, tex);
    } else {
      const charX = d.u32(pixelPos.x - charMinX);
      const charY = d.u32(pixelPos.y - charMinY);
      const charXy = d.vec2u(charX, charY);
      const charTex = std.textureLoad(charView.$, charXy, 0);
      const charAlpha = charTex.a * candidate.opacity;
      const blendedRgb = std.mix(tex.rgb, charTex.rgb, charAlpha);
      const blended = d.vec4f(
        blendedRgb,
        tex.a + charTex.a * candidate.opacity,
      );
      if (charAlpha > 0.01) {
        std.atomicAdd(avgColorBuffer.$[0].r, d.u32(blendedRgb.r * 255));
        std.atomicAdd(avgColorBuffer.$[0].g, d.u32(blendedRgb.g * 255));
        std.atomicAdd(avgColorBuffer.$[0].b, d.u32(blendedRgb.b * 255));
        std.atomicAdd(avgColorBuffer.$[0].count, 1);
      }
      std.textureStore(editedImageView.$, xy, blended);
    }
  });

  program.dispatchThreads(viewSize[0], viewSize[1]);

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

      const color = std.textureSample(editedImageSampledView.$, sampler.$, uv);
      return color;
    },
  });

  // alpha mode를 premultiplied로 설정하면 alpha blending이 자동으로 됨
  const context = root.configureContext({
    canvas: debugCanvas,
    alphaMode: "premultiplied",
  });
  pipeline
    .withColorAttachment({
      view: context,
    })
    .draw(6);

  // 0~255 사이의 값을 0~1 사이의 값으로 바꾸기
  const sampleAvgColor = await avgColorBuffer.read();
  for (const color of sampleAvgColor) {
    color.r = color.r / (color.count * 255);
    color.g = color.g / (color.count * 255);
    color.b = color.b / (color.count * 255);
  }
  return sampleAvgColor;
}
