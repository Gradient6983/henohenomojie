import {
  d,
  tgpu,
  type TgpuRoot,
  type TgpuTexture,
  type TgpuTextureView,
} from "typegpu";
import {
  CHAR_CANVAS_SETTINGS,
  GLYPH_SEARCH_CONFIG,
  NEAREST_SAMPLER_DESCRIPTOR,
  SCORING_CONFIG,
  TEXTURE_FORMAT,
} from "./const/glyphConfig";
import { getFilledCanvas } from "./webgpu/imageCanvas";

export default class Manager {
  static readonly textureFormat = TEXTURE_FORMAT;
  static readonly nearestSamplerDescriptor = NEAREST_SAMPLER_DESCRIPTOR;
  static readonly charCanvasSettings = CHAR_CANVAS_SETTINGS;
  static readonly glyphSearchConfig = GLYPH_SEARCH_CONFIG;
  static readonly scoringConfig = SCORING_CONFIG;

  // WebGPU root. Initialized when training actually starts, not at module load time.
  // (This ensures the home screen still renders correctly even on browsers without WebGPU support.)
  static root: TgpuRoot;
  /** Original image background */
  static imageTexture: TgpuTexture;
  static imageView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** Character image */
  static charTexture: TgpuTexture;
  static charView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** Difference image */
  static differenceTexture: TgpuTexture;
  static differenceView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** Heatmap image */
  static stampTexture: TgpuTexture;
  static stampView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** Original image */
  static image: HTMLImageElement;
  /** Device pixel ratio */
  static dpr: number = window.devicePixelRatio || 1;
  /** Canvas width */
  static canvasWidth: number;
  /** Canvas height */
  static canvasHeight: number;
  /** Character size */
  static charSize: number;

  /**
   * Ensures the WebGPU root exists. Runs tgpu.init() only on the first call and caches it afterward.
   * In environments where WebGPU is unavailable, tgpu.init() throws, so the caller must handle it.
   */
  static async ensureRoot(): Promise<TgpuRoot> {
    if (!Manager.root) {
      Manager.root = await tgpu.init();
    }
    return Manager.root;
  }

  /** Load image */
  static async loadImage(imageLink: string) {
    // Uses a Promise so that other functions can await this function
    Manager.image = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve(image);
      };
      image.onerror = (e) => {
        console.error(
          `[Manager] Failed to load the image at ${imageLink}.`,
          e,
        );
        reject(e);
      };
      image.src = imageLink;
    });
  }

  /** Initialize the image texture */
  static initTexture() {
    const image = Manager.image;
    const canvasWidth = Manager.canvasWidth;
    const canvasHeight = Manager.canvasHeight;

    if (!image) throw new Error("[Manager] The image does not exist.");

    const texture = Manager.root
      .createTexture({
        size: [Manager.canvasWidth, Manager.canvasHeight],
        format: Manager.textureFormat,
      })
      .$usage("sampled");
    texture.write(image);
    Manager.imageTexture = texture;
    Manager.imageView = texture.createView(d.texture2d(d.f32));

    // Initialize the difference texture
    const initDiffTexture = getFilledCanvas();

    const differenceTexture = Manager.createStorageTexture(
      canvasWidth,
      canvasHeight,
    );

    differenceTexture.write(initDiffTexture);
    const differenceView = differenceTexture.createView(d.texture2d(d.f32));
    Manager.differenceTexture = differenceTexture;
    Manager.differenceView = differenceView;

    const heatmapTexture = Manager.createStorageTexture(canvasWidth, canvasHeight);
    heatmapTexture.write(getFilledCanvas([0, 0, 0]));
    const heatmapView = heatmapTexture.createView(d.texture2d(d.f32));
    Manager.stampTexture = heatmapTexture;
    Manager.stampView = heatmapView;
  }

  static initSizes() {
    if (!Manager.image)
      throw new Error("[Manager] The image does not exist.");

    const dpr = Manager.dpr;
    const image = Manager.image;
    const canvasWidth = image.width * dpr;
    const canvasHeight = image.height * dpr;
    Manager.canvasWidth = canvasWidth;
    Manager.canvasHeight = canvasHeight;
    Manager.charSize = canvasWidth / 2;
  }

  static initCanvas(canvas: HTMLCanvasElement) {
    if (!Manager.canvasWidth || !Manager.canvasHeight)
      throw new Error("[Manager] The canvas size has not been initialized.");
    canvas.width = Manager.canvasWidth;
    canvas.height = Manager.canvasHeight;
  }

  static createNearestSampler() {
    return Manager.root.createSampler(Manager.nearestSamplerDescriptor);
  }

  static createStorageTexture(width: number, height: number) {
    return Manager.root
      .createTexture({
        size: [width, height],
        format: Manager.textureFormat,
      })
      .$usage("sampled")
      .$usage("storage");
  }

  static updateCharTextureFromCanvas(charCanvas: HTMLCanvasElement) {
    const charTexture = Manager.createStorageTexture(
      charCanvas.width,
      charCanvas.height,
    );
    charTexture.write(charCanvas);
    const charView = charTexture.createView(d.texture2d(d.f32));
    Manager.charTexture = charTexture;
    Manager.charView = charView;
    return { charTexture, charView };
  }

  static createDifferenceWorkingSet() {
    const tex = Manager.createStorageTexture(Manager.canvasWidth, Manager.canvasHeight);
    return {
      texture: tex,
      sampledView: tex.createView(d.texture2d(d.f32)),
      storageView: tex.createView(d.textureStorage2d(Manager.textureFormat)),
    };
  }

  static createStampWorkingSet() {
    const tex = Manager.createStorageTexture(Manager.canvasWidth, Manager.canvasHeight);
    return {
      texture: tex,
      sampledView: tex.createView(d.texture2d(d.f32)),
      storageView: tex.createView(d.textureStorage2d(Manager.textureFormat)),
    };
  }

  static commitDifferenceAndStamp(
    differenceTexture: TgpuTexture,
    differenceView: TgpuTextureView<d.WgslTexture2d<d.F32>>,
    stampTexture: TgpuTexture,
    stampView: TgpuTextureView<d.WgslTexture2d<d.F32>>,
  ) {
    Manager.differenceTexture = differenceTexture;
    Manager.differenceView = differenceView;
    Manager.stampTexture = stampTexture;
    Manager.stampView = stampView;
  }

  static async initWithImageAndCanvas(
    imageLink: string,
    outputCanvas: HTMLCanvasElement,
  ) {
    await Manager.ensureRoot();
    await Manager.loadImage(imageLink);
    Manager.initSizes();
    Manager.initTexture();
    Manager.initCanvas(outputCanvas);
  }
}
