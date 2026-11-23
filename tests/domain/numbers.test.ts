import { describe, expect, it } from 'vitest';
import {
  formatSignedWeight, formatWeight, parseReps, parseRpe, parseWeight, round2, toNumber,
} from '@/domain/numbers';

describe('toNumber', () => {
  it('returns null for empty values', () => {
    for (const v of [null, undefined, '', '   ', 'abc', NaN, Infinity, true, {}]) expect(toNumber(v)).toBeNull();
  });
  it('parses numbers and comma strings', () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber(' 62,5 ')).toBe(62.5);
    expect(toNumber('1,2,3')).toBeNull();
    expect(toNumber('12.5')).toBe(12.5);
  });
});

describe('round2', () => {
  it('rounds to 0.01', () => {
    expect(round2(12.345)).toBe(12.35);
    expect(round2(1.2)).toBe(1.2);
  });
});

describe('parseWeight', () => {
  it('handles spec examples', () => {
    expect(parseWeight('62,5')).toBe(62.5);
    expect(parseWeight('-5')).toBeNull();
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('0')).toBe(0);
    expect(parseWeight('12.345')).toBe(12.35);
    expect(parseWeight('abc')).toBeNull();
  });
});

describe('parseReps / parseRpe', () => {
  it('parseReps', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('8.5')).toBeNull();
    expect(parseReps('-1')).toBeNull();
    expect(parseReps('0')).toBe(0);
    expect(parseReps(null)).toBeNull();
  });
  it('parseRpe', () => {
    expect(parseRpe('5')).toBeNull();
    expect(parseRpe('6')).toBe(6);
    expect(parseRpe('10')).toBe(10);
    expect(parseRpe('11')).toBeNull();
    expect(parseRpe('8.5')).toBeNull();
    expect(parseRpe('')).toBeNull();
  });
});

describe('formatWeight', () => {
  it('formats', () => {
    expect(formatWeight(62.5)).toBe('62,5');
    expect(formatWeight(100)).toBe('100');
    expect(formatWeight(null)).toBe('-');
    expect(formatWeight('12.345')).toBe('12,35');
  });
});

describe('formatSignedWeight', () => {
  it('formats with sign', () => {
    expect(formatSignedWeight(0)).toBe('+0');
    expect(formatSignedWeight(-2.5)).toBe('-2,5');
    expect(formatSignedWeight(2.5)).toBe('+2,5');
    expect(formatSignedWeight(undefined)).toBe('-');
  });
});
