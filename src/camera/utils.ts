export const THUMBNAIL_MAX_DIM = 512;
export const THUMBNAIL_JPEG_QUALITY = 0.85;

/** Downscales the source canvas and returns it as a JPEG Blob. */
export function canvasToThumbnailBlob(
  source: HTMLCanvasElement,
  maxDim = THUMBNAIL_MAX_DIM,
): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', THUMBNAIL_JPEG_QUALITY);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

/** Reads an image file, downscales it to a thumbnail, and returns a Blob. */
export async function fileToThumbnailBlob(file: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, THUMBNAIL_MAX_DIM / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasToThumbnailBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function cameraError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') {
      return 'Camera access was denied. Allow camera access in your browser settings, or choose a photo from your files instead.';
    }
    if (e.name === 'NotFoundError') {
      return 'No camera was found on this device. You can still choose a photo from your files.';
    }
    if (e.name === 'NotReadableError') {
      return 'The camera appears to be in use by another application. Close it and try again.';
    }
    if (e.name === 'SecurityError') {
      return 'Camera access requires a secure (HTTPS) connection. You can still choose a photo from your files.';
    }
  }
  return 'The camera could not be started. You can choose a photo from your files instead.';
}
