import { describe, expect, it } from 'vitest';
import {
  BODY_SLUGS, MUSCLE_CATALOG, autoView, bodySlugsFor, matchesQuery, muscleKey, muscleKeys, normalizeMuscleGroups,
} from '@/domain/muscles';

describe('catalog', () => {
  it('has 15 entries, each resolving to a distinct key', () => {
    expect(MUSCLE_CATALOG).toHaveLength(15);
    for (const m of MUSCLE_CATALOG) expect(muscleKey(m)).not.toBeNull();
    expect(new Set(MUSCLE_CATALOG.map((m) => muscleKey(m))).size).toBe(15);
  });
});

describe('normalizeMuscleGroups', () => {
  it('trims, dedupes keeping first casing, ignores non strings', () => {
    expect(normalizeMuscleGroups([' Pecs', 'pecs', 3, '', 'Épaules', 'ÉPAULES'])).toEqual(['Pecs', 'Épaules']);
    expect(normalizeMuscleGroups('x')).toEqual([]);
  });
});

describe('muscleKey', () => {
  it('resolves aliases', () => {
    expect(muscleKey('Pectoraux')).toBe('pecs');
    expect(muscleKey('Épaules')).toBe('epaules');
    expect(muscleKey('Bas du dos')).toBe('bas du dos');
    expect(muscleKey('Grand dorsal')).toBe('grand dorsal');
    expect(muscleKey('Libre')).toBeNull();
    expect(muscleKeys('Psoas')).toEqual(['psoas']);
    expect(muscleKeys('dos lombaires')).toEqual(['grand dorsal', 'bas du dos']);
  });
});

describe('body slugs', () => {
  it('maps labels to slugs', () => {
    expect(bodySlugsFor(['Abdominaux'])).toEqual(['abs', 'obliques']);
    expect(bodySlugsFor(['Pectoraux', 'Pecs', 'Psoas', 'Libre'])).toEqual(['chest']);
    expect(bodySlugsFor(['Abducteurs'])).toEqual(['adductors']);
    expect(BODY_SLUGS['pecs']).toEqual(['chest']);
    expect(BODY_SLUGS['psoas']).toBeUndefined();
  });
  it('autoView', () => {
    expect(autoView(['upper-back'])).toBe('back');
    expect(autoView(['upper-back', 'chest'])).toBe('front');
    expect(autoView(['calves'])).toBe('front');
    expect(autoView([])).toBe('front');
  });
});

describe('matchesQuery', () => {
  const squat = { name: 'Squat', muscleGroups: ['Quadriceps'] };
  it('matches name, muscle, alias', () => {
    expect(matchesQuery(squat, 'quads')).toBe(true);
    expect(matchesQuery(squat, 'SQU')).toBe(true);
    expect(matchesQuery(squat, 'quadri')).toBe(true);
    expect(matchesQuery(squat, 'biceps')).toBe(false);
    expect(matchesQuery({ name: 'Dév', muscleGroups: ['Pectoraux'] }, 'chest')).toBe(true);
    expect(matchesQuery(squat, '  ')).toBe(true);
  });
});
