import { d, std } from "typegpu";
import Manager from "../manager";
import type { CharPos } from "../types/geometry";
import { createGpuCandidate, gpuCandidateStruct } from "./gpuUtils";

export async function computeColor(
  charPosList: CharPos[],
  charCanvas: HTMLCanvasElement,
) {
  if (!Manager.imageTexture) {
    console.warn(
      "[compute] No background texture yet. Press compute after the main canvas image has loaded.",
    );
    return;
  }

  // Initialization
  const root = Manager.root;
  const { alphaThreshold, colorNormMax } = Manager.scoringConfig;

  // Create the storage buffer
  const candidateBuffer = root.createReadonly(
    d.arrayOf(gpuCandidateStruct, charPosList.length),
  );
  candidateBuffer.write(charPosList.map(createGpuCandidate));

  const view = Manager.imageView;

  // Create the char texture (reused via Manager in diffDebug, etc.)
  const { charView } = Manager.updateCharTextureFromCanvas(charCanvas);

  const avgColor = d.struct({
    r: d.atomic(d.u32),
    g: d.atomic(d.u32),
    b: d.atomic(d.u32),
    count: d.atomic(d.u32),
  });

  // Pass the length of dataList as a uniform
  const dataLength = root.createUniform(d.i32, charPosList.length);
  const avgColorBuffer = root.createMutable(
    d.arrayOf(avgColor, charPosList.length),
  );

  // Create the program that runs on the GPU
  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    // The most common approach is to read with textureLoad and write with textureStore
    const tex = std.textureLoad(view.$, xy, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);

    const charMaxX = d.f32(charTexDimension.x) / d.f32(2.0);
    const charMaxY = d.f32(charTexDimension.y) / d.f32(2.0);
    const charMinX = -charMaxX;
    const charMinY = -charMaxY;

    // read candidate buffer
    for (let i = 0; i < dataLength.$; i++) {
      // For now, read only the very first element
      const candidate = candidateBuffer.$[i];
      // Compute which part of the char texture this pixel's coordinate maps to
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
          // The value actually added should just be the background color
          // TODO: This color does not account for the character's alpha, so correct it later
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

  // Convert values in the 0~255 range to the 0~1 range
  const sampleAvgColor = await avgColorBuffer.read();
  for (const color of sampleAvgColor) {
    color.r = color.r / (color.count * colorNormMax);
    color.g = color.g / (color.count * colorNormMax);
    color.b = color.b / (color.count * colorNormMax);
  }
  return sampleAvgColor;
}
