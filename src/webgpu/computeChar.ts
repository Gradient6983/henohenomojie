import { d, std } from "typegpu";
import Manager from "../manager";
import type { CharPos, Color } from "../types/geometry";
import { createGpuCandidate, gpuCandidateStruct } from "./gpuUtils";

/**
 * Creates a texture with the character drawn on it and renders that texture to the canvas.
 * @param charPos Character position data
 * @param color Character color
 * @param evolutionCanvas Canvas to draw the character on
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

  const sampler = Manager.createNearestSampler();

  const diffTex = Manager.differenceTexture;
  const diffView = Manager.differenceView;
  const charTex = Manager.charTexture;
  const charView = Manager.charView;

  if (!diffTex || !charTex) return;

  const charPosBuffer = root.createUniform(gpuCandidateStruct, {
    ...createGpuCandidate(charPos),
    color: d.vec3f(color[0], color[1], color[2]),
  });

  const differenceSet = Manager.createDifferenceWorkingSet();
  const tex = differenceSet.texture;
  const view = differenceSet.sampledView;
  const sampledView = differenceSet.storageView;
  const stampTex = Manager.stampTexture.$usage("sampled").$usage("storage");
  const stampView = stampTex.createView(d.texture2d(d.f32));
  const stampSet = Manager.createStampWorkingSet();
  const newStampTex = stampSet.texture;
  const newStampView = stampSet.sampledView;
  const stampStoreView = stampSet.storageView;

  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    // The most common approach is to read with textureLoad and write with textureStore
    const diffTexColor = std.textureLoad(diffView.$, xy, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);

    const charMaxX = d.f32(charTexDimension.x) / d.f32(2.0);
    const charMaxY = d.f32(charTexDimension.y) / d.f32(2.0);
    const charMinX = -charMaxX;
    const charMinY = -charMaxY;

    // For now, read only the very first element
    const charPos = charPosBuffer.$;
    // Compute which part of the char texture this pixel's coordinate maps to
    const pixelPos = charPos.transform.mul(d.vec3f(d.f32(xy.x), d.f32(xy.y), d.f32(1.0)));

    const xCondition = pixelPos.x >= charMinX && pixelPos.x <= charMaxX;
    const yCondition = pixelPos.y >= charMinY && pixelPos.y <= charMaxY;
    if (!xCondition || !yCondition) {
      std.textureStore(sampledView.$, xy, diffTexColor);
      // Copy the existing value as-is
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
      // Also update the stamp texture
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

  // Apply the position of the top-ranked character data to the texture
  Manager.commitDifferenceAndStamp(tex, view, newStampTex, newStampView);

  // Create the pipeline
  const pipeline = root.createRenderPipeline({
    primitive: { topology: "triangle-list" },
    vertex: ({ $vertexIndex: vid }) => {
      "use gpu";

      // Create a quad that covers the entire canvas
      const positions = [
        d.vec2f(-1.0, -1.0),
        d.vec2f(-1.0, 1.0),
        d.vec2f(1.0, -1.0),
        d.vec2f(1.0, 1.0),
        d.vec2f(-1.0, 1.0),
        d.vec2f(1.0, -1.0),
      ];

      const pos = positions[vid];
      // -1 ~ 1 -> 0 ~ 1, flip the y axis
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

  // Setting alpha mode to premultiplied makes alpha blending happen automatically
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
