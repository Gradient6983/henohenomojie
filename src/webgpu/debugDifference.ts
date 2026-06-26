import { d, std } from "typegpu";
import Manager from "../manager";
import type { CharPos, Color } from "../type";
import { createGpuCandidate, gpuCandidateStruct } from "./gpuUtils";

/**
 * 차이를 계산하는 compute shader를 실행하는 함수
 * @param color 색상 배열
 * @param data 데이터 배열
 * @returns 차이 배열
 */
export async function debugDifference(color: Color[], data: CharPos[]) {
  const root = Manager.root;
  const {
    alphaThreshold,
    stampOccK,
    scoreFactor,
    colorNormDenominator,
    invalidPenalty,
  } = Manager.scoringConfig;

  const diffTex = Manager.differenceTexture.$usage("sampled").$usage("storage");
  const diffView = diffTex.createView(d.texture2d(d.f32));

  if (!Manager.charTexture) return;
  const charTex = Manager.charTexture.$usage("sampled").$usage("storage");
  const charView = charTex.createView(d.texture2d(d.f32));

  const diffBuffer = root.createMutable(
    d.arrayOf(d.atomic(d.u32), data.length),
  );
  const activePixelBuffer = root.createMutable(
    d.arrayOf(d.atomic(d.u32), data.length),
  );
  const candidateBuffer = root.createReadonly(
    d.arrayOf(gpuCandidateStruct, data.length),
  );
  candidateBuffer.write(data.map(createGpuCandidate));

  const charColorBuffer = root.createReadonly(d.arrayOf(d.vec3f, color.length));
  charColorBuffer.write(color.map((c) => d.vec3f(...c)));
  const bgTextureView = Manager.imageView;
  if (!bgTextureView) return;

  const dataLength = root.createUniform(d.i32, data.length);

  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    const bgTex = std.textureLoad(bgTextureView.$, xy, 0);
    const diffTex = std.textureLoad(diffView.$, xy, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);
    const charMaxX = d.f32(charTexDimension.x) / d.f32(2.0);
    const charMaxY = d.f32(charTexDimension.y) / d.f32(2.0);
    const charMinX = -charMaxX;
    const charMinY = -charMaxY;

    for (let i = 0; i < d.i32(dataLength.$); i++) {
      const candidate = candidateBuffer.$[i];
      const pixelPos = candidate.transform.mul(
        d.vec3f(d.f32(xy.x), d.f32(xy.y), d.f32(1.0)),
      );
      const xCondition = pixelPos.x >= charMinX && pixelPos.x <= charMaxX;
      const yCondition = pixelPos.y >= charMinY && pixelPos.y <= charMaxY;

      let evalColor = diffTex.rgb;
      if (xCondition && yCondition) {
        const charX = d.u32(pixelPos.x - charMinX);
        const charY = d.u32(pixelPos.y - charMinY);
        const charXy = d.vec2u(charX, charY);
        const charTex = std.textureLoad(charView.$, charXy, 0);
        const charAlpha = charTex.a * candidate.opacity;
        if (charAlpha > d.f32(alphaThreshold)) {
          const charColor = charColorBuffer.$[i];
          evalColor = std.mix(evalColor, charColor, charAlpha);
        }
      }

      const currDist = std.distance(bgTex.rgb, evalColor);
      const normDist = currDist / d.f32(colorNormDenominator);
      const stamp = std.textureLoad(Manager.stampView.$, xy, 0).r;
      const score = normDist * (d.f32(1.0) + d.f32(stampOccK) * stamp);

      const factor = d.f32(scoreFactor);
      std.atomicAdd(diffBuffer.$[i], d.u32(score * factor));
      std.atomicAdd(activePixelBuffer.$[i], d.u32(d.f32(1.0) * factor));
    }
  });

  program.dispatchThreads(Manager.canvasWidth, Manager.canvasHeight);

  const diffArray = await diffBuffer.read();
  const activePixelArray = await activePixelBuffer.read();
  const averagedDiffArray = diffArray.map((diff, index) => {
    const active = activePixelArray[index];
    if (active === 0) return invalidPenalty;
    return diff / activePixelArray[index];
  });

  return averagedDiffArray;
}
