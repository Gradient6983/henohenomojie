import { d, std } from "typegpu";
import Manager from "../../manager";
import type { SobelEdgeResult, SobelOptions } from "../../types/image";

/**
 * Applies a Sobel filter via TypeGPU to the background image texture currently loaded in Manager
 * to extract an outline (edge) image. Handles only the WebGPU/TypeGPU logic and is decoupled from DOM/Svelte.
 */
export async function computeSobelEdges(
  options: SobelOptions = {},
): Promise<SobelEdgeResult> {
  if (!Manager.imageView) {
    throw new Error("[sobel] No image texture. Load an image first.");
  }

  const root = Manager.root;
  const width = Manager.canvasWidth;
  const height = Manager.canvasHeight;
  const view = Manager.imageView;

  // Store each pixel's result in a u32 array packed as RGBA8 so it can be read back in one pass.
  const dims = root.createUniform(d.vec2u, d.vec2u(width, height));
  const thresholdUniform = root.createUniform(d.f32, options.threshold ?? 0.2);
  const edgeBuffer = root.createMutable(d.arrayOf(d.u32, width * height));

  // Luminance conversion weights (Rec. 601)
  const luminanceWeights = d.vec3f(0.299, 0.587, 0.114);

  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const w = d.i32(dims.$.x);
    const h = d.i32(dims.$.y);
    const x = d.i32(xIdx);
    const y = d.i32(yIdx);

    // Clamp the coordinates so edge pixels don't read outside the texture.
    const xm = std.max(x - 1, 0);
    const xp = std.min(x + 1, w - 1);
    const ym = std.max(y - 1, 0);
    const yp = std.min(y + 1, h - 1);

    const lTL = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(xm), d.u32(ym)), 0).rgb,
      luminanceWeights,
    );
    const lTM = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(x), d.u32(ym)), 0).rgb,
      luminanceWeights,
    );
    const lTR = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(xp), d.u32(ym)), 0).rgb,
      luminanceWeights,
    );
    const lML = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(xm), d.u32(y)), 0).rgb,
      luminanceWeights,
    );
    const lMR = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(xp), d.u32(y)), 0).rgb,
      luminanceWeights,
    );
    const lBL = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(xm), d.u32(yp)), 0).rgb,
      luminanceWeights,
    );
    const lBM = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(x), d.u32(yp)), 0).rgb,
      luminanceWeights,
    );
    const lBR = std.dot(
      std.textureLoad(view.$, d.vec2u(d.u32(xp), d.u32(yp)), 0).rgb,
      luminanceWeights,
    );

    // Standard Sobel kernel
    const gx = lTR + d.f32(2.0) * lMR + lBR - (lTL + d.f32(2.0) * lML + lBL);
    const gy = lBL + d.f32(2.0) * lBM + lBR - (lTL + d.f32(2.0) * lTM + lTR);

    const magnitude = std.sqrt(gx * gx + gy * gy);

    let edge = magnitude;
    if (magnitude < thresholdUniform.$) {
      edge = d.f32(0.0);
    }

    const idx = d.u32(yIdx) * dims.$.x + d.u32(xIdx);
    // Black line + edge intensity as alpha -> when overlaid, only the outline shows over the background.
    edgeBuffer.$[idx] = std.pack4x8unorm(
      d.vec4f(d.f32(0.0), d.f32(0.0), d.f32(0.0), edge),
    );
  });

  program.dispatchThreads(width, height);

  const packed = (await edgeBuffer.read()) as number[];
  // pack4x8unorm stores component i at bit 8*i, so the order is [r,g,b,a] on little-endian.
  const u32 = Uint32Array.from(packed);
  const bytes = new Uint8Array(u32.buffer);
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.set(bytes);

  return { width, height, rgba };
}

/**
 * Converts the Sobel result into a 2D canvas. This canvas can be used as the source for PIXI.Texture.from().
 */
export function sobelResultToCanvas(
  result: SobelEdgeResult,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[sobel] Failed to create a 2D context.");
  const imageData = new ImageData(result.rgba, result.width, result.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Downloads the Sobel result as a PNG file.
 */
export async function downloadSobelEdges(
  result: SobelEdgeResult,
  filename: string,
): Promise<void> {
  const canvas = sobelResultToCanvas(result);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("[sobel] Failed to convert to PNG.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
