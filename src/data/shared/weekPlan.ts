import { z } from 'zod';
import type { WeekPlan } from '../../domain/model';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const day = z.number().int().min(0).max(6);

const week = z.array(z.string().min(1).nullable()).length(7);
const emptyDays = () => ({ A: Array<null>(7).fill(null), B: Array<null>(7).fill(null) });

/**
 * Format stocké (Supabase `week_plan.days/overrides`, mock, repli local) ; valeurs invalides ignorées.
 * L'ancien format (tableau de rangs, une semaine pour les deux cycles) est lu comme un planning vide.
 */
export const weekPlanSchema = z.object({
  days: z.object({ A: week, B: week }).catch(emptyDays),
  overrides: z.array(z.union([
    z.object({ week: isoDate, day, kind: z.literal('moved'), date: isoDate }),
    z.object({ week: isoDate, day, kind: z.literal('skipped') }),
  ])).catch([]),
});

export function parseWeekPlan(raw: unknown): WeekPlan | null {
  const parsed = weekPlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
