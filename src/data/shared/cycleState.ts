import { z } from 'zod';
import type { CycleState } from '../../domain/model';

/**
 * Forme stockée d'un état de cycle, anciennes données comprises : `weeks` (2 ou 3, avant la durée
 * réglable) est converti en `lengthDays` 14 + `extraDays` (weeks − 2) × 7.
 */
export const storedCycleFields = {
  weeks: z.number().int().min(1).nullish(),
  lengthDays: z.number().int().min(7).max(28).nullish(),
  extraDays: z.number().int().min(0).nullish(),
};

interface StoredCycle { weeks?: number | null; lengthDays?: number | null; extraDays?: number | null }

export function cycleLengths(r: StoredCycle): Pick<CycleState, 'lengthDays' | 'extraDays'> {
  if (r.lengthDays != null) return { lengthDays: r.lengthDays, extraDays: r.extraDays ?? 0 };
  const weeks = r.weeks ?? 2;
  return { lengthDays: 14, extraDays: Math.max(0, (weeks - 2) * 7) };
}
