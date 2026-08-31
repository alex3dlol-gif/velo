const MAX_DIMENSION = 1080;
const WEBP_QUALITY = 0.82;

export type CompressedPhoto = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
};

/** Client-side WebP compression, max 1080p longest edge. */
export async function compressPhotoToWebP(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_DIMENSION);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("WebP encoding failed"))),
      "image/webp",
      WEBP_QUALITY,
    );
  });

  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl, width, height };
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
