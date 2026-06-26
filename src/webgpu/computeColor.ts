import { d, std } from "typegpu";
import Manager from "../manager";
import type { CharPos } from "../type";
import { createGpuCandidate, gpuCandidateStruct } from "./gpuUtils";

export async function computeColor(
  charPosList: CharPos[],
  charCanvas: HTMLCanvasElement,
) {
  if (!Manager.imageTexture) {
    console.warn(
      "[compute] 배경 텍스처가 아직 없습니다. 메인 캔버스 이미지가 로드된 뒤에 compute를 눌러주세요.",
    );
    return;
  }

  // 초기화
  const root = Manager.root;
  const { alphaThreshold, colorNormMax } = Manager.scoringConfig;

  // storage buffer 생성
  const candidateBuffer = root.createReadonly(
    d.arrayOf(gpuCandidateStruct, charPosList.length),
  );
  candidateBuffer.write(charPosList.map(createGpuCandidate));

  const view = Manager.imageView;

  // char texture 생성 (diffDebug 등에서 Manager로 재사용)
  const { charView } = Manager.updateCharTextureFromCanvas(charCanvas);

  const avgColor = d.struct({
    r: d.atomic(d.u32),
    g: d.atomic(d.u32),
    b: d.atomic(d.u32),
    count: d.atomic(d.u32),
  });

  // dataList의 길이를 uniform으로 전달
  const dataLength = root.createUniform(d.i32, charPosList.length);
  const avgColorBuffer = root.createMutable(
    d.arrayOf(avgColor, charPosList.length),
  );

  // gpu에서 실행되는 프로그램 생성
  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    // 가장 흔한 방식은 textureLoad로 읽어오고, textureStore로 저장하는 방식
    const tex = std.textureLoad(view.$, xy, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);

    const charMaxX = d.f32(charTexDimension.x) / d.f32(2.0);
    const charMaxY = d.f32(charTexDimension.y) / d.f32(2.0);
    const charMinX = -charMaxX;
    const charMinY = -charMaxY;

    // read candidate buffer
    for (let i = 0; i < dataLength.$; i++) {
      // 일단 가장 첫번째 요소만 읽어옴
      const candidate = candidateBuffer.$[i];
      // 픽셀의 해당 좌표가 char texture의 어느 부분에 들어가는지 계산하기
      const pixelPos = candidate.transform.mul(
        d.vec3f(d.f32(xy.x), d.f32(xy.y), d.f32(1.0)),
      );

      const xCondition = pixelPos.x >= charMinX && pixelPos.x <= charMaxX;
      const yCondition = pixelPos.y >= charMinY && pixelPos.y <= charMaxY;
      if (xCondition && yCondition) {
        const charX = d.u32(pixelPos.x - charMinX);
        const charY = d.u32(pixelPos.y - charMinY);
        const charXy = d.vec2u(charX, charY);
        const charTex = std.textureLoad(charView.$, charXy, 0);
        const charAlpha = charTex.a * candidate.opacity;

        if (charAlpha > d.f32(alphaThreshold)) {
          // 실제로 더해주는 값은 그냥 배경의 색을 더해줘야 함
          // TODO: 글자의 알파값은 반영이 안된 색상이기 때문에 나중에 보정해주기
          std.atomicAdd(
            avgColorBuffer.$[i].r,
            d.u32(tex.rgb.r * d.f32(colorNormMax)),
          );
          std.atomicAdd(
            avgColorBuffer.$[i].g,
            d.u32(tex.rgb.g * d.f32(colorNormMax)),
          );
          std.atomicAdd(
            avgColorBuffer.$[i].b,
            d.u32(tex.rgb.b * d.f32(colorNormMax)),
          );
          std.atomicAdd(avgColorBuffer.$[i].count, d.u32(1));
        }
      }
    }
  });

  program.dispatchThreads(Manager.canvasWidth, Manager.canvasHeight);

  // 0~255 사이의 값을 0~1 사이의 값으로 바꾸기
  const sampleAvgColor = await avgColorBuffer.read();
  for (const color of sampleAvgColor) {
    color.r = color.r / (color.count * colorNormMax);
    color.g = color.g / (color.count * colorNormMax);
    color.b = color.b / (color.count * colorNormMax);
  }
  return sampleAvgColor;
}
