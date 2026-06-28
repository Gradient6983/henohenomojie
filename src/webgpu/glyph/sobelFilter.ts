import { d, std } from "typegpu";
import Manager from "../../manager";

export interface SobelEdgeResult {
  width: number;
  height: number;
  /**
   * RGBA8 픽셀 데이터. 검은색(0,0,0) 윤곽선 + 알파(엣지 강도)로 구성된다.
   * Canvas의 ImageData나 PixiJS 텍스처 소스로 그대로 사용할 수 있다.
   */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

export interface SobelOptions {
  /** 0~1 사이. 이 값보다 약한 엣지는 제거하여 노이즈를 줄인다. 기본 0.2 */
  threshold?: number;
}

/**
 * 현재 Manager에 로드된 배경 이미지 텍스처에 TypeGPU로 Sobel 필터를 적용하여
 * 윤곽선(엣지) 이미지를 추출한다. WebGPU/TypeGPU 로직만 담당하며 DOM/Svelte와 분리되어 있다.
 */
export async function computeSobelEdges(
  options: SobelOptions = {},
): Promise<SobelEdgeResult> {
  if (!Manager.imageView) {
    throw new Error("[sobel] 이미지 텍스처가 없습니다. 먼저 이미지를 로드하세요.");
  }

  const root = Manager.root;
  const width = Manager.canvasWidth;
  const height = Manager.canvasHeight;
  const view = Manager.imageView;

  // 한 번에 읽어오기 위해 각 픽셀의 결과를 RGBA8로 패킹한 u32 배열에 저장한다.
  const dims = root.createUniform(d.vec2u, d.vec2u(width, height));
  const thresholdUniform = root.createUniform(d.f32, options.threshold ?? 0.2);
  const edgeBuffer = root.createMutable(d.arrayOf(d.u32, width * height));

  // 휘도(luminance) 변환 가중치 (Rec. 601)
  const luminanceWeights = d.vec3f(0.299, 0.587, 0.114);

  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const w = d.i32(dims.$.x);
    const h = d.i32(dims.$.y);
    const x = d.i32(xIdx);
    const y = d.i32(yIdx);

    // 가장자리 픽셀이 텍스처 밖을 읽지 않도록 좌표를 clamp 한다.
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

    // 표준 Sobel 커널
    const gx = lTR + d.f32(2.0) * lMR + lBR - (lTL + d.f32(2.0) * lML + lBL);
    const gy = lBL + d.f32(2.0) * lBM + lBR - (lTL + d.f32(2.0) * lTM + lTR);

    const magnitude = std.sqrt(gx * gx + gy * gy);

    let edge = magnitude;
    if (magnitude < thresholdUniform.$) {
      edge = d.f32(0.0);
    }

    const idx = d.u32(yIdx) * dims.$.x + d.u32(xIdx);
    // 검은색 선 + 엣지 강도를 알파로 → 오버레이 시 배경 위에 윤곽선만 보인다.
    edgeBuffer.$[idx] = std.pack4x8unorm(
      d.vec4f(d.f32(0.0), d.f32(0.0), d.f32(0.0), edge),
    );
  });

  program.dispatchThreads(width, height);

  const packed = (await edgeBuffer.read()) as number[];
  // pack4x8unorm은 컴포넌트 i를 8*i 비트에 저장하므로 리틀엔디언에서 [r,g,b,a] 순이 된다.
  const u32 = Uint32Array.from(packed);
  const bytes = new Uint8Array(u32.buffer);
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.set(bytes);

  return { width, height, rgba };
}

/**
 * Sobel 결과를 2D 캔버스로 변환한다. 이 캔버스는 PIXI.Texture.from()의 소스로 사용할 수 있다.
 */
export function sobelResultToCanvas(
  result: SobelEdgeResult,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[sobel] 2D 컨텍스트를 만들 수 없습니다.");
  const imageData = new ImageData(result.rgba, result.width, result.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Sobel 결과를 PNG 파일로 다운로드한다.
 */
export async function downloadSobelEdges(
  result: SobelEdgeResult,
  filename: string,
): Promise<void> {
  const canvas = sobelResultToCanvas(result);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("[sobel] PNG 변환에 실패했습니다.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
