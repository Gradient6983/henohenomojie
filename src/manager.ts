import {
  d,
  tgpu,
  type TgpuRoot,
  type TgpuTexture,
  type TgpuTextureView,
} from "typegpu";
import type { CharPosRange } from "./type";
import { getFilledCanvas } from "./util";

export default class Manager {
  static readonly textureFormat = "rgba16float" as const;
  static readonly nearestSamplerDescriptor = {
    magFilter: "nearest" as const,
    minFilter: "nearest" as const,
  };

  static readonly charCanvasSettings = {
    charSize: 960,
    charPadding: 10,
    fontFamily: "Pretendard JP Variable",
    fontWeight: 700,
    textColor: "rgb(0, 0, 0)",
  } as const;

  static readonly glyphSearchConfig = {
    candidateNum: 2000,
    epochNum: 10,
    topCandidateNum: 50,
    charPosClip: {
      x: { min: 0, max: 1 },
      y: { min: 0, max: 1 },
      scale: { min: 0.01, max: 1.5 },
      opacity: { min: 0.2, max: 1 },
      rotation: { min: 0, max: 360 },
    } as CharPosRange,
    charScaleVariance: 0.01,
    otherVariance: 0.01,
    scaleStepFactor: 0.02,
    scaleDecayFactor: 1.5,
  } as const;

  static readonly scoringConfig = {
    alphaThreshold: 0.01,
    stampOccK: 0.2,
    stampGain: 0.02,
    scoreFactor: 4096,
    colorNormDenominator: 1.732,
    colorNormMax: 255,
    invalidPenalty: 1e9,
  } as const;

  // WebGPU 루트. 모듈 로드 시점이 아니라 실제로 훈련을 시작할 때 초기화한다.
  // (이렇게 해야 WebGPU 미지원 브라우저에서도 홈 화면 자체는 정상적으로 뜬다.)
  static root: TgpuRoot;
  /** 원본 이미지 배경 */
  static imageTexture: TgpuTexture;
  static imageView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** 글자 이미지 */
  static charTexture: TgpuTexture;
  static charView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** 차이 이미지 */
  static differenceTexture: TgpuTexture;
  static differenceView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** 히트맵 이미지 */
  static stampTexture: TgpuTexture;
  static stampView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** 원본 이미지 */
  static image: HTMLImageElement;
  /** 디바이스 픽셀 비율 */
  static dpr: number = window.devicePixelRatio || 1;
  /** 캔버스 너비 */
  static canvasWidth: number;
  /** 캔버스 높이 */
  static canvasHeight: number;
  /** 글자 크기 */
  static charSize: number;

  /**
   * WebGPU 루트를 보장한다. 최초 호출 시에만 tgpu.init()을 수행하고 이후엔 캐시한다.
   * WebGPU를 사용할 수 없는 환경이면 tgpu.init()이 throw 하므로 호출 측에서 처리해야 한다.
   */
  static async ensureRoot(): Promise<TgpuRoot> {
    if (!Manager.root) {
      Manager.root = await tgpu.init();
    }
    return Manager.root;
  }

  /** 이미지 로드 */
  static async loadImage(imageLink: string) {
    // 다른 함수에서 이 함수를 await와 쓰기 위해 Promise를 사용함
    Manager.image = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve(image);
      };
      image.onerror = (e) => {
        console.error(
          `[Manager] ${imageLink}의 이미지를 로드하는데 실패했습니다.`,
          e,
        );
        reject(e);
      };
      image.src = imageLink;
    });
  }

  /** 이미지 텍스처 초기화 */
  static initTexture() {
    const image = Manager.image;
    const canvasWidth = Manager.canvasWidth;
    const canvasHeight = Manager.canvasHeight;

    if (!image) throw new Error("[Manager] 이미지가 존재하지 않습니다.");

    const texture = Manager.root
      .createTexture({
        size: [Manager.canvasWidth, Manager.canvasHeight],
        format: Manager.textureFormat,
      })
      .$usage("sampled");
    texture.write(image);
    Manager.imageTexture = texture;
    Manager.imageView = texture.createView(d.texture2d(d.f32));

    // difference texture 초기화
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
      throw new Error("[Manager] 이미지가 존재하지 않습니다.");

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
      throw new Error("[Manager] 캔버스 크기가 초기화되지 않았습니다.");
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
