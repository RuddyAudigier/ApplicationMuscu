import { z } from 'zod';
import { normalizeMuscleGroups } from '../../domain/muscles';
import { parseWeight, toNumber } from '../../domain/numbers';
import { DEFAULT_VARIANT, hasDuplicateVariantNames, normalizeVariants } from '../../domain/variants';
import type {
  ExerciseDraft, IsoDate, Performance, PerformanceInput, SessionDraft, Variant,
} from '../../domain/model';
import { ValidationError } from '../ports';

/* Règles partagées par les backends Supabase et mock (aucune divergence). */

/* ---------- Lecture : ligne `performances` (snake_case, validée par Zod) → modèle (INV §2.2) ---------- */

const numeric = z.union([z.number(), z.string()]);
const optText = z.string().nullish();

const performanceRow = z.object({
  id: z.union([z.string(), z.number()]),
  exercise_id: optText,
  exercise_name: optText,
  session_name: optText,
  reps: numeric,
  weight: numeric.nullish(),
  rpe: numeric.nullish(),
  variant_id: optText,
  variant_name: optText,
  series_number: numeric.nullish(),
  performance_date: z.string(),
  created_at: optText,
});

export function mapPerformanceRow(raw: unknown): Performance | null {
  const parsed = performanceRow.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const reps = toNumber(r.reps);
  if (reps === null) return null;
  return {
    id: String(r.id),
    exerciseId: r.exercise_id ?? null,
    exerciseName: r.exercise_name ?? '',
    sessionName: r.session_name ?? '',
    reps,
    weight: toNumber(r.weight),
    rpe: toNumber(r.rpe),
    variantId: r.variant_id ?? null,
    variantName: r.variant_name || DEFAULT_VARIANT,
    serieNumber: toNumber(r.series_number) ?? 1,
    performanceDate: r.performance_date,
    createdAt: r.created_at ?? null,
  };
}

/** Applique `map` à chaque ligne ; ignore les lignes invalides avec un seul `console.warn`. */
export function parseRows<T>(raw: unknown, map: (row: unknown) => T | null, label: string): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  let skipped = 0;
  for (const row of raw as unknown[]) {
    const mapped = map(row);
    if (mapped === null) skipped += 1;
    else out.push(mapped);
  }
  if (skipped > 0) console.warn(`[data] ${label} : ${String(skipped)} ligne(s) invalide(s) ignorée(s).`);
  return out;
}

/* ---------- Écriture : validations partagées Supabase / mock ---------- */

const INVALID_PERFORMANCE_MESSAGE =
  'Entrée performance invalide: mets reps > 0 avec un poids >= 0, ou reps=0 et poids vide pour une série non complétée.';

export interface PerformanceRowWrite {
  exercise_id: string | null; exercise_name: string; session_name: string; reps: number; weight: number | null;
  rpe: number; variant_id: string | null; variant_name: string; series_number: number; performance_date: IsoDate;
}

/** Les entrées viennent aussi d'imports CSV : `Number()` comme l'existant, même si le type dit `number`. */
const num = (v: unknown): number => Number(v);

/**
 * INV §3.4 : une seule entrée invalide rejette tout le lot ; seules les entrées `reps > 0` sont écrites.
 */
export function preparePerformances(inputs: PerformanceInput[], today: IsoDate): PerformanceRowWrite[] {
  const invalid = inputs.some((p) => {
    const reps = num(p.reps);
    if (reps === 0) return false;
    return !Number.isFinite(reps) || reps <= 0 || parseWeight(p.weight) === null;
  });
  if (invalid) throw new ValidationError(INVALID_PERFORMANCE_MESSAGE);
  return inputs.filter((p) => num(p.reps) > 0).map((p) => toPerformanceRow(p, today));
}

export function toPerformanceRow(p: PerformanceInput, today: IsoDate): PerformanceRowWrite {
  return {
    exercise_id: p.exerciseId,
    exercise_name: p.exerciseName,
    session_name: p.sessionName,
    reps: num(p.reps),
    weight: parseWeight(p.weight),
    rpe: p.rpe ?? 10,
    variant_id: p.variantId || null,
    variant_name: p.variantName || DEFAULT_VARIANT,
    series_number: p.serieNumber,
    performance_date: p.performanceDate || today,
  };
}

export interface PreparedExercise { name: string; description: string; muscleGroups: string[]; variants: Variant[] }

export function prepareExercise(d: ExerciseDraft, exerciseId: string | null): PreparedExercise {
  const name = d.name.trim();
  if (!name) throw new ValidationError("Le nom de l'exercice est requis.");
  const named = d.variants.filter((v) => v.name.trim() !== '');
  if (hasDuplicateVariantNames(named)) throw new ValidationError('Deux variantes portent le même nom.');
  return {
    name,
    description: d.description,
    muscleGroups: normalizeMuscleGroups(d.muscleGroups),
    variants: normalizeVariants(named, exerciseId),
  };
}

export function prepareSession(d: SessionDraft): SessionDraft {
  const name = d.name.trim();
  if (!name || d.exercises.length === 0) throw new ValidationError('Nom de séance manquant.');
  for (const e of d.exercises) {
    if (!Number.isInteger(e.series) || e.series < 1) throw new ValidationError('Nombre de séries invalide (entier ≥ 1).');
  }
  return { name, cycle: d.cycle, exercises: d.exercises.map((e) => ({ exerciseId: e.exerciseId, series: e.series })) };
}

/** CRLF / CR → LF (INV §3.16). */
export function normalizeNotes(notes: string): string {
  return notes.replace(/\r\n?/g, '\n');
}
