import { describe, expect, it } from 'vitest';
import { normalizeExerciseName, normalizeHeader, normalizeSearch, normalizeVariantName } from '@/domain/names';

describe('names', () => {
  it('normalizeExerciseName', () => {
    expect(normalizeExerciseName('  Développé   Couché! ')).toBe('developpe couche');
    expect(normalizeExerciseName('')).toBeNull();
    expect(normalizeExerciseName(null)).toBeNull();
    expect(normalizeExerciseName('!!!')).toBeNull();
  });
  it('normalizeVariantName', () => {
    expect(normalizeVariantName(undefined)).toBe('touch and go');
    expect(normalizeVariantName('  Pause   Haute ')).toBe('pause haute');
    expect(normalizeVariantName('Écarté')).toBe('écarté');
  });
  it('normalizeSearch', () => {
    expect(normalizeSearch('  Épaules ')).toBe('epaules');
  });
  it('normalizeHeader', () => {
    expect(normalizeHeader(' Date de Séance (UTC) ')).toBe('date_de_seance_utc');
    expect(normalizeHeader('__Poids__')).toBe('poids');
  });
});
