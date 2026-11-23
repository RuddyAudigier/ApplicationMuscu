import { z } from 'zod';
import { normalizeMuscleGroups } from '../../domain/muscles';
import { toNumber } from '../../domain/numbers';
import { normalizeVariants } from '../../domain/variants';
import type { CycleState, Exercise, GeneralAdvice, Session, SessionExercise, Variant } from '../../domain/model';

/* Lignes snake_case (validées par Zod) → modèle (INV §2.2). Performances : voir `../shared/rules`. */

const numeric = z.union([z.number(), z.string()]);
const optText = z.string().nullish();

const variantRow = z.object({ id: z.string(), exercise_id: z.string(), name: z.string(), is_default: z.boolean().nullish() });

export function mapVariantRow(raw: unknown): Variant | null {
  const parsed = variantRow.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { id: r.id, exerciseId: r.exercise_id, name: r.name, isDefault: r.is_default ?? false };
}

const exerciseRow = z.object({
  id: z.string(),
  name: z.string(),
  description: optText,
  muscle_groups: z.unknown(),
  is_custom: z.boolean().nullish(),
  created_at: optText,
});

export function mapExerciseRow(raw: unknown, variants: Variant[], coachNotes: string): Exercise | null {
  const parsed = exerciseRow.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    muscleGroups: normalizeMuscleGroups(r.muscle_groups),
    variants: normalizeVariants(variants, r.id),
    isCustom: r.is_custom ?? true,
    createdAt: r.created_at ?? '',
    coachNotes,
  };
}

const nestedExercise = z.object({ name: z.string() });
const sessionRow = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  /** Colonne ajoutée par la migration cycles (Task 21) : absente ou invalide → `null` (la séance reste). */
  cycle: z.enum(['A', 'B']).nullish().catch(null),
  session_exercises: z.array(z.object({
    series_count: numeric.nullish(),
    exercise_id: z.string().nullish(),
    exercises: z.union([nestedExercise, z.array(nestedExercise)]).nullish(),
  })).nullish(),
});

/** `createdAt` reste ISO ; les exercices supprimés (jointure nulle) sont ignorés (D12). */
export function mapSessionRow(raw: unknown): Session | null {
  const parsed = sessionRow.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const exercises: SessionExercise[] = [];
  for (const se of r.session_exercises ?? []) {
    const ex = Array.isArray(se.exercises) ? se.exercises[0] : se.exercises;
    if (!ex || !se.exercise_id) continue;
    exercises.push({ exerciseId: se.exercise_id, name: ex.name, series: toNumber(se.series_count) ?? 1 });
  }
  return { id: r.id, name: r.name, createdAt: r.created_at, cycle: r.cycle ?? null, exercises };
}

const adviceRow = z.object({ training_notes: optText, nutrition_notes: optText, sleep_notes: optText });

export function mapAdviceRow(raw: unknown): GeneralAdvice | null {
  const parsed = adviceRow.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { training: r.training_notes ?? '', nutrition: r.nutrition_notes ?? '', sleep: r.sleep_notes ?? '' };
}


const cycleStateRow = z.object({
  current: z.enum(['A', 'B']),
  started_on: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  weeks: z.union([z.literal(2), z.literal(3)]),
});

/** `started_on` (type `date`) → `IsoDate` ; ligne invalide → `null`. */
export function mapCycleStateRow(raw: unknown): CycleState | null {
  const parsed = cycleStateRow.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { current: r.current, startedOn: r.started_on.slice(0, 10), weeks: r.weeks };
}
