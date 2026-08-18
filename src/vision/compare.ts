import type { VisualMetadata } from '../db/types';

export type VisualBreakdown = {
  color: number;
  histogram: number;
  size: number;
  shape: number;
  hash: number;
};

export type VisualComparison = {
  score: number;
  match: boolean;
  breakdown: VisualBreakdown;
  referenceMissing: boolean;
  capturedMissing: boolean;
  /** True when an image could not be analyzed (pill vs background unclear). */
  degenerate: boolean;
};

/** Below this score the images are considered inconsistent. */
export const MATCH_THRESHOLD = 0.7;

// Hard minimums per feature: failing any of these means no match, regardless
// of the weighted score. This stops "similar color on a similar background"
// from slipping through on the score alone.
const COLOR_GATE = 0.45;
const HIST_GATE = 0.3;
const HASH_GATE = 0.3;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function colorSimilarity(a: [number, number, number], b: [number, number, number]): number {
  const d = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  return clamp01(1 - d / 441.7);
}

function histogramIntersection(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  let inter = 0;
  for (let i = 0; i < len; i++) {
    inter += Math.min(a[i] ?? 0, b[i] ?? 0);
  }
  return clamp01(inter);
}

function sizeSimilarity(a: number, b: number): number {
  const denom = Math.max(a, b, 0.05);
  return clamp01(1 - Math.abs(a - b) / denom);
}

function aspectSimilarity(a: number, b: number): number {
  const denom = Math.max(a, b, 0.01);
  return clamp01(1 - Math.abs(a - b) / denom);
}

function gridDifference(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    diff += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return diff / len;
}

function hashSimilarity(a: string, b: string): number {
  const len = Math.max(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    const ha = parseInt(a[i] ?? '0', 16);
    const hb = parseInt(b[i] ?? '0', 16);
    const xor = ha ^ hb;
    diff += (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
  }
  return clamp01(1 - diff / (len * 4));
}

/**
 * Compares two local visual descriptors and returns a 0..1 consistency score.
 * This is a convenience/consistency check only — it cannot identify a medicine,
 * cannot guarantee identity or safety, and must never be treated as medical proof.
 */
export function compareVisualMetadata(
  reference: VisualMetadata | null,
  captured: VisualMetadata | null,
): VisualComparison {
  if (!reference && !captured) {
    return {
      score: 0,
      match: false,
      breakdown: { color: 0, histogram: 0, size: 0, shape: 0, hash: 0 },
      referenceMissing: true,
      capturedMissing: true,
      degenerate: false,
    };
  }
  if (!reference || !captured) {
    return {
      score: 0,
      match: false,
      breakdown: { color: 0, histogram: 0, size: 0, shape: 0, hash: 0 },
      referenceMissing: !reference,
      capturedMissing: !captured,
      degenerate: false,
    };
  }
  // If either image could not separate the medicine from the background, we
  // cannot trust the descriptor — refuse to treat it as a match.
  if (reference.degenerate || captured.degenerate) {
    return {
      score: 0,
      match: false,
      breakdown: { color: 0, histogram: 0, size: 0, shape: 0, hash: 0 },
      referenceMissing: false,
      capturedMissing: false,
      degenerate: true,
    };
  }

  const color = colorSimilarity(reference.dominantColor, captured.dominantColor);
  const histogram = histogramIntersection(reference.colorHistogram, captured.colorHistogram);
  const size = sizeSimilarity(reference.sizeRatio, captured.sizeRatio);
  const shape = clamp01(
    0.7 * (1 - gridDifference(reference.grid, captured.grid)) +
      0.3 * aspectSimilarity(reference.aspectRatio, captured.aspectRatio),
  );
  const hash = hashSimilarity(reference.hash, captured.hash);

  const score = clamp01(
    0.2 * color + 0.3 * histogram + 0.1 * size + 0.2 * shape + 0.2 * hash,
  );
  const gatesPassed = color >= COLOR_GATE && histogram >= HIST_GATE && hash >= HASH_GATE;

  return {
    score,
    match: gatesPassed && score >= MATCH_THRESHOLD,
    breakdown: { color, histogram, size, shape, hash },
    referenceMissing: false,
    capturedMissing: false,
    degenerate: false,
  };
}
