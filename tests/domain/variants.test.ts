import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VARIANT, getDefaultVariant, hasDuplicateVariantNames, normalizeVariants, sameVariant, variantLabel, variantMatches,
} from '@/domain/variants';
import type { Variant } from '@/domain/model';

describe('variantLabel', () => {
  it('shows the default variant as « Classique »', () => {
    expect(variantLabel('Touch and Go')).toBe('Classique');
    expect(variantLabel('  touch  AND go ')).toBe('Classique');
    expect(variantLabel('')).toBe('Classique');
    expect(variantLabel('Pause')).toBe('Pause');
  });
});

const v = (name: string, isDefault = false, id: string | null = null): Variant => ({ id, exerciseId: 'e1', name, isDefault });

describe('normalizeVariants', () => {
  it('returns default for empty/invalid input', () => {
    const expected = [{ id: null, exerciseId: 'e1', name: 'Touch and Go', isDefault: true }];
    expect(normalizeVariants([], 'e1')).toEqual(expected);
    expect(normalizeVariants('x', 'e1')).toEqual(expected);
    expect(normalizeVariants([' ', 3, { name: 4 }, null], 'e1')).toEqual(expected);
    expect(DEFAULT_VARIANT).toBe('Touch and Go');
    expect(normalizeVariants(undefined, null)[0]?.exerciseId).toBeNull();
  });
  it('keeps exactly one default (the first)', () => {
    const out = normalizeVariants([{ name: 'Pause', isDefault: true }, { name: 'Tempo', isDefault: true }], 'e1');
    expect(out.filter((x) => x.isDefault)).toHaveLength(1);
    expect(out[0]?.isDefault).toBe(true);
    expect(out[1]?.isDefault).toBe(false);
  });
  it('picks touch and go when no default, else first', () => {
    expect(normalizeVariants(['Pause', 'touch AND go'], 'e1').map((x) => x.isDefault)).toEqual([false, true]);
    expect(normalizeVariants(['Pause', 'Tempo'], 'e1').map((x) => x.isDefault)).toEqual([true, false]);
  });
  it('accepts strings/objects, trims, dedupes, keeps ids', () => {
    const out = normalizeVariants(['  Pause ', 'PAUSE', { id: 'v1', exerciseId: 'x', name: 'Tempo' }], 'e1');
    expect(out).toEqual([
      { id: null, exerciseId: 'e1', name: 'Pause', isDefault: true },
      { id: 'v1', exerciseId: 'x', name: 'Tempo', isDefault: false },
    ]);
  });
});

describe('getDefaultVariant', () => {
  it('returns default, else first, else built-in', () => {
    expect(getDefaultVariant([v('A'), v('B', true)]).name).toBe('B');
    expect(getDefaultVariant([v('A'), v('B')]).name).toBe('A');
    expect(getDefaultVariant([]).name).toBe('Touch and Go');
  });
});

describe('variantMatches', () => {
  it('matches by id then by name', () => {
    expect(variantMatches(v('A', false, 'v1'), { variantId: 'v1', variantName: 'zzz' })).toBe(true);
    expect(variantMatches(v('Pause  Haute'), { variantId: null, variantName: ' pause haute' })).toBe(true);
    expect(variantMatches(v('Pause'), { variantId: 'v2', variantName: 'Tempo' })).toBe(false);
    expect(variantMatches(v('Touch and Go'), { variantId: null, variantName: '' })).toBe(true);
  });
});

describe('sameVariant (identité unique : tableau des records et détection de PR)', () => {
  it('compares ids when both have one, otherwise normalised names', () => {
    expect(sameVariant({ variantId: 'v1', variantName: 'Ancien' }, { id: 'v1', name: 'Nouveau' })).toBe(true);
    expect(sameVariant({ variantId: 'v1', variantName: 'Pause' }, { id: 'v3', name: 'Pause' })).toBe(false);
    expect(sameVariant({ variantId: null, variantName: 'pause' }, { id: 'v1', name: 'Pause' })).toBe(true);
    expect(sameVariant({ variantId: 'v1', variantName: ' PAUSE ' }, { id: null, name: 'pause' })).toBe(true);
    expect(sameVariant({ variantId: null, variantName: '' }, { id: null, name: 'Touch and Go' })).toBe(true);
    expect(sameVariant({ variantId: null, variantName: 'Tempo' }, { id: null, name: 'Pause' })).toBe(false);
  });
});

describe('hasDuplicateVariantNames', () => {
  it('detects duplicates case-insensitively', () => {
    expect(hasDuplicateVariantNames([v('Pause'), v(' pause ')])).toBe(true);
    expect(hasDuplicateVariantNames([v('Pause'), v('Tempo')])).toBe(false);
    expect(hasDuplicateVariantNames([])).toBe(false);
  });
});
