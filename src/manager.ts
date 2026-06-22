import {
  d,
  tgpu,
  type TgpuRoot,
  type TgpuTexture,
  type TgpuTextureView,
} from "typegpu";
import { getFilledCanvas } from "./util";

const root = await tgpu.init();

export default class Manager {
  static root: TgpuRoot = root;
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
        format: "rgba16float" as const,
      })
      .$usage("sampled");
    texture.write(image);
    Manager.imageTexture = texture;
    Manager.imageView = texture.createView(d.texture2d(d.f32));

    // difference texture 초기화
    const initDiffTexture = getFilledCanvas();

    const differenceTexture = root
      .createTexture({
        size: [canvasWidth, canvasHeight],
        format: "rgba16float" as const,
      })
      .$usage("sampled")
      .$usage("storage");

    differenceTexture.write(initDiffTexture);
    const differenceView = differenceTexture.createView(d.texture2d(d.f32));
    Manager.differenceTexture = differenceTexture;
    Manager.differenceView = differenceView;

    const heatmapTexture = root
      .createTexture({
        size: [canvasWidth, canvasHeight],
        format: "rgba16float" as const,
      })
      .$usage("sampled")
      .$usage("storage");
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
}
