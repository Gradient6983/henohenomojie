function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = src;
  });
}

/**
 * 임의 크기의 이미지를 받아 짧은 변이 정확히 `shortSide`(기본 1080)가 되도록
 * 비율을 유지한 채 리샘플링한 PNG data URL을 반환한다.
 *
 * 기본 학습 데이터(1920x1080 / 1080x1080)와 좌표/스케일 분포를 맞추기 위해
 * 훈련 전에 한 번 적용한다.
 */
export async function normalizeImageShortSide(
  src: string,
  shortSide = 1080,
): Promise<string> {
  const img = await loadImageElement(src);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (width <= 0 || height <= 0) {
    throw new Error("[normalizeImage] 이미지 크기를 읽을 수 없습니다.");
  }

  const shorter = Math.min(width, height);
  const scale = shortSide / shorter;
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[normalizeImage] 2D 컨텍스트를 만들 수 없습니다.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL("image/png");
}
