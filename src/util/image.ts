// Image loading/resampling utilities (Canvas 2D based, no WebGPU dependency).

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = src;
  });
}

/**
 * Takes an image of arbitrary size and returns a PNG data URL resampled while
 * keeping the aspect ratio, so that the short side is exactly `shortSide` (default 1080).
 *
 * Applied once before training to align the coordinate/scale distribution with the
 * default training data (1920x1080 / 1080x1080).
 */
export async function normalizeImageShortSide(
  src: string,
  shortSide = 1080,
): Promise<string> {
  const img = await loadImageElement(src);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (width <= 0 || height <= 0) {
    throw new Error("[normalizeImage] Failed to read the image size.");
  }

  const shorter = Math.min(width, height);
  const scale = shortSide / shorter;
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[normalizeImage] Failed to create a 2D context.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL("image/png");
}
