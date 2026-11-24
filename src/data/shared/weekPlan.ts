import { z } from 'zod';
import type { WeekPlan } from '../../domain/model';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const day = z.number().int().min(0).max(6);

/** Format stocké (Supabase `week_plan.days/overrides`, mock, repli local) ; valeurs invalides ignorées. */
export const weekPlanSchema = z.object({
  days: z.array(z.number().int().min(0).nullable()).length(7),
  overrides: z.array(z.union([
    z.object({ week: isoDate, day, kind: z.literal('moved'), date: isoDate }),
    z.object({ week: isoDate, day, kind: z.literal('skipped') }),
  ])).catch([]),
});

export function parseWeekPlan(raw: unknown): WeekPlan | null {
  const parsed = weekPlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
