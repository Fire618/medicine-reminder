import { describe, expect, it } from 'vitest';
import { compareVisualMetadata, MATCH_THRESHOLD } from './compare';
import type { VisualMetadata } from '../db/types';

function makeMeta(overrides: Partial<VisualMetadata> = {}): VisualMetadata {
  return {
    dominantColor: [200, 50, 50],
    colorHistogram: Array(64).fill(1 / 64),
    sizeRatio: 0.3,
    aspectRatio: 1.0,
    grid: Array(64).fill(0.5),
    hash: '0'.repeat(16),
    ...overrides,
  };
}

describe('compareVisualMetadata', () => {
  it('scores identical images at 1.0 and marks a match', () => {
    const a = makeMeta();
    const result = compareVisualMetadata(a, { ...a });
    expect(result.score).toBeCloseTo(1, 5);
    expect(result.match).toBe(true);
    expect(result.referenceMissing).toBe(false);
    expect(result.capturedMissing).toBe(false);
  });

  it('does not match clearly different images', () => {
    const a = makeMeta();
    const b = makeMeta({
      dominantColor: [0, 0, 0],
      colorHistogram: Array.from({ length: 64 }, (_, i) => (i === 63 ? 1 : 0)),
      sizeRatio: 0.7,
      aspectRatio: 2.0,
      grid: Array(64).fill(0.1),
      hash: 'f'.repeat(16),
    });
    const result = compareVisualMetadata(a, b);
    expect(result.score).toBeLessThan(MATCH_THRESHOLD);
    expect(result.match).toBe(false);
  });

  it('returns a non-match when either image is missing', () => {
    const a = makeMeta();
    const missingRef = compareVisualMetadata(null, a);
    expect(missingRef.match).toBe(false);
    expect(missingRef.referenceMissing).toBe(true);

    const missingCaptured = compareVisualMetadata(a, null);
    expect(missingCaptured.match).toBe(false);
    expect(missingCaptured.capturedMissing).toBe(true);
  });

  it('returns a non-match when both images are missing', () => {
    const result = compareVisualMetadata(null, null);
    expect(result.match).toBe(false);
    expect(result.referenceMissing).toBe(true);
    expect(result.capturedMissing).toBe(true);
  });

  it('treats small color differences as a match', () => {
    const a = makeMeta();
    const b = makeMeta({
      dominantColor: [205, 55, 55],
      colorHistogram: a.colorHistogram,
      sizeRatio: 0.32,
      aspectRatio: 1.02,
      grid: a.grid,
      hash: a.hash,
    });
    const result = compareVisualMetadata(a, b);
    expect(result.match).toBe(true);
  });
});
