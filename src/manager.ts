import { d, tgpu, type TgpuTexture, type TgpuTextureView } from "typegpu";

const root = await tgpu.init();

export default class Manager {
  static readonly root = root;
  /** 원본 이미지 배경 */
  static bgTexture: TgpuTexture;
  static bgView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** 글자 이미지 */
  static charTexture: TgpuTexture;
  static charView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** 차이 이미지 */
  static differenceTexture: TgpuTexture;
  static differenceView: TgpuTextureView<d.WgslTexture2d<d.F32>>;
  /** 원본 이미지 */
  static image: HTMLImageElement;
  /** 디바이스 픽셀 비율 */
  static dpr: number = window.devicePixelRatio || 1;
  /** 캔버스 너비 */
  static canvasWidth: number;
  /** 캔버스 높이 */
  static canvasHeight: number;
}
