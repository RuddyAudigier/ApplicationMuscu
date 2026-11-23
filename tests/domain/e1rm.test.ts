import { describe, expect, it } from 'vitest';
import { e1rm, roundE1rm } from '@/domain/e1rm';

describe('e1rm (Epley)', () => {
  it('computes weight × (1 + reps/30)', () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.33, 2);
    expect(e1rm(100, 5)).toBeCloseTo(116.667, 3);
    expect(e1rm('100', '5')).toBeCloseTo(116.667, 3);
    expect(e1rm('92,5', 6)).toBeCloseTo(111, 6);
  });

  it('returns null for invalid inputs', () => {
    expect(e1rm(0, 5)).toBeNull();
    expect(e1rm(100, 0)).toBeNull();
    expect(e1rm(-5, 5)).toBeNull();
    expect(e1rm(100, -1)).toBeNull();
    expect(e1rm(null, 5)).toBeNull();
    expect(e1rm(100, 'abc')).toBeNull();
    expect(e1rm(Number.NaN, 5)).toBeNull();
  });
});

describe('roundE1rm', () => {
  it('rounds to one decimal', () => {
    expect(roundE1rm(116.666)).toBe(116.7);
    expect(roundE1rm(103.33)).toBe(103.3);
  });
  it('returns null when not finite', () => {
    expect(roundE1rm(null)).toBeNull();
    expect(roundE1rm(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
