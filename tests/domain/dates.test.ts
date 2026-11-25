import { describe, expect, it } from 'vitest';
import { compareIso, isoToFr, isoToShortFr, parseDateToIso, performanceTimestamp, todayIso } from '@/domain/dates';

describe('parseDateToIso', () => {
  it('parses supported formats', () => {
    expect(parseDateToIso('7/3/2026')).toBe('2026-03-07');
    expect(parseDateToIso('07.03.2026 10:00')).toBe('2026-03-07');
    expect(parseDateToIso('07-03-2026')).toBe('2026-03-07');
    expect(parseDateToIso('2026-03-07T10:00')).toBe('2026-03-07');
    expect(parseDateToIso('2026-03-07 10:00')).toBe('2026-03-07');
    expect(parseDateToIso(' 2026-03-07 ')).toBe('2026-03-07');
  });
  it('rejects invalid calendar dates', () => {
    expect(parseDateToIso('31/02/2026')).toBeNull();
    expect(parseDateToIso('2026-13-01')).toBeNull();
    expect(parseDateToIso('29/02/2024')).toBe('2024-02-29');
    expect(parseDateToIso('29/02/2025')).toBeNull();
    expect(parseDateToIso('0/1/2026')).toBeNull();
  });
  it('falls back to Date parsing using the local day', () => {
    expect(parseDateToIso('March 7, 2026 00:30')).toBe('2026-03-07');
    expect(parseDateToIso('not a date')).toBeNull();
    expect(parseDateToIso('')).toBeNull();
    expect(parseDateToIso(null)).toBeNull();
    expect(parseDateToIso(42)).toBeNull();
  });
});

describe('todayIso', () => {
  it('uses the local day', () => {
    expect(todayIso(new Date(2026, 2, 7, 0, 30))).toBe('2026-03-07');
    expect(todayIso(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
  it('defaults to the current date', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatting and compare', () => {
  it('formats', () => {
    expect(isoToFr('2026-03-07')).toBe('07/03/2026');
    expect(isoToShortFr('2026-03-07')).toBe('07/03');
    expect(isoToFr('garbage')).toBe('garbage');
    expect(isoToShortFr('garbage')).toBe('garbage');
  });
  it('compareIso', () => {
    expect(compareIso('2026-03-07', '2026-03-08')).toBeLessThan(0);
    expect(compareIso('2026-03-08', '2026-03-07')).toBeGreaterThan(0);
    expect(compareIso('2026-03-07', '2026-03-07')).toBe(0);
  });
});

describe('performanceTimestamp', () => {
  it('uses createdAt when same local day', () => {
    const created = new Date(2026, 2, 7, 15, 30).toISOString();
    expect(performanceTimestamp({ performanceDate: '2026-03-07', createdAt: created })).toBe(Date.parse(created));
  });
  it('uses local midnight when createdAt is another day', () => {
    const created = new Date(2026, 2, 8, 15, 30).toISOString();
    expect(performanceTimestamp({ performanceDate: '2026-03-07', createdAt: created })).toBe(new Date(2026, 2, 7).getTime());
  });
  it('uses local midnight when createdAt is null or invalid', () => {
    expect(performanceTimestamp({ performanceDate: '07/03/2026', createdAt: null })).toBe(new Date(2026, 2, 7).getTime());
    expect(performanceTimestamp({ performanceDate: '2026-03-07', createdAt: 'zzz' })).toBe(new Date(2026, 2, 7).getTime());
  });
  it('returns null when date invalid', () => {
    expect(performanceTimestamp({ performanceDate: 'nope', createdAt: null })).toBeNull();
  });
});
