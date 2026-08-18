import type { VisualMetadata } from '../db/types';

const WORK_MAX_DIM = 96;
const GRID = 8;
const HIST_BUCKETS = 64;
const FG_DISTANCE_SQ = 60 * 60;
const MIN_FG_RATIO = 0.02;
const MAX_FG_RATIO = 0.97;

type Loaded = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

async function loadToCanvas(blob: Blob): Promise<Loaded> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, WORK_MAX_DIM / Math.max(img.width, img.height));
    const width = Math.max(8, Math.round(img.width * scale));
    const height = Math.max(8, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, width, height);
    return { canvas, ctx, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function estimateBackground(ctx: CanvasRenderingContext2D, w: number, h: number): [number, number, number] {
  const data = ctx.getImageData(0, 0, w, h).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const sample = (i: number) => {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  };
  for (let x = 0; x < w; x++) {
    sample(x * 4);
    sample(((h - 1) * w + x) * 4);
  }
  for (let y = 1; y < h - 1; y++) {
    sample(y * w * 4);
    sample((y * w + w - 1) * 4);
  }
  if (n === 0) return [128, 128, 128];
  return [r / n, g / n, b / n];
}

/** Pixels close to the background estimate are treated as background. */
function isForeground(r: number, g: number, b: number, bg: [number, number, number]): boolean {
  const d = (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2;
  const bgSq = bg[0] * bg[0] + bg[1] * bg[1] + bg[2] * bg[2];
  return !(d < FG_DISTANCE_SQ && d < bgSq * 0.1);
}

function computeStats(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: [number, number, number],
): {
  fgCount: number;
  fgR: number;
  fgG: number;
  fgB: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  histogram: number[];
  grid: number[];
} {
  const data = ctx.getImageData(0, 0, w, h).data;
  const histogram = new Array(HIST_BUCKETS).fill(0);
  const grid = new Array(GRID * GRID).fill(0);
  let fgCount = 0;
  let fgR = 0;
  let fgG = 0;
  let fgB = 0;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isForeground(r, g, b, bg)) continue;
      fgCount += 1;
      fgR += r;
      fgG += g;
      fgB += b;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      const rb = r >> 6;
      const gb = g >> 6;
      const bb = b >> 6;
      histogram[rb * 16 + gb * 4 + bb] += 1;
      const cy = Math.min(GRID - 1, Math.floor((y * GRID) / h));
      const cx = Math.min(GRID - 1, Math.floor((x * GRID) / w));
      grid[cy * GRID + cx] += 1;
    }
  }

  return { fgCount, fgR, fgG, fgB, bbox: { x0, y0, x1, y1 }, histogram, grid };
}

function dHash(
  source: HTMLCanvasElement,
  box: { x0: number; y0: number; x1: number; y1: number },
): string {
  const c = document.createElement('canvas');
  c.width = 9;
  c.height = 8;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return '';
  const bw = Math.max(1, box.x1 - box.x0 + 1);
  const bh = Math.max(1, box.y1 - box.y0 + 1);
  g.drawImage(source, box.x0, box.y0, bw, bh, 0, 0, 9, 8);
  const data = g.getImageData(0, 0, 9, 8).data;
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const rightLum = 0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6];
      bits = (bits << 1n) | (lum >= rightLum ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

/**
 * Extracts local, device-side visual characteristics from an image.
 * This is a color/shape consistency descriptor — it never identifies a medicine.
 */
export async function analyzeImageBlob(blob: Blob): Promise<VisualMetadata> {
  const { ctx, width, height } = await loadToCanvas(blob);
  const bg = estimateBackground(ctx, width, height);
  const stats = computeStats(ctx, width, height, bg);

  const total = width * height;
  const fgCount = Math.max(1, stats.fgCount);
  const fgRatio = stats.fgCount / total;
  const sizeRatio = fgRatio;

  // If the pill cannot be separated from the background (e.g. white pill on a
  // white surface, or the frame is one solid color) the descriptor is not
  // meaningful — flag it so the comparison refuses to treat it as a match.
  const degenerate = fgRatio < MIN_FG_RATIO || fgRatio > MAX_FG_RATIO;

  const bw = Math.max(1, stats.bbox.x1 - stats.bbox.x0 + 1);
  const bh = Math.max(1, stats.bbox.y1 - stats.bbox.y0 + 1);
  const aspectRatio = bw / bh;

  const grid = stats.grid.map((n) => n / fgCount);
  const histogram = stats.histogram.map((n) => n / fgCount);

  return {
    dominantColor: [stats.fgR / fgCount, stats.fgG / fgCount, stats.fgB / fgCount],
    colorHistogram: histogram,
    sizeRatio,
    aspectRatio,
    grid,
    hash: dHash(ctx.canvas, stats.bbox),
    degenerate,
  };
}
