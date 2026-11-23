import type { Exercise, IsoDate, Variant } from '@/domain/model';
import { normalizeVariantName } from '@/domain/names';
import { parseReps, parseWeight } from '@/domain/numbers';
import { PR_EPSILON, classify, findPreviousBest, type HistoryIndex } from '@/domain/records';
import { normalizeVariants } from '@/domain/variants';
import { canValidate, resolveVariant, type SerieEntry, type WorkoutExercise } from '@/domain/workout';

/** Clé de variante d'une série (même règle que le domaine) : id si connu, sinon nom. */
export const variantKeyOf = (v: Variant): string => v.id ?? v.name;

/** La variante correspond à la clé d'une série (id, ou nom normalisé). */
export const isSameVariant = (v: Variant, key: string): boolean =>
  (v.id !== null && v.id === key) || normalizeVariantName(v.name) === normalizeVariantName(key);

/** Variantes affichables : celles de l'exercice, sinon la variante par défaut. */
export const variantsOf = (exercise: Exercise | undefined, exerciseId: string): Variant[] =>
  exercise && exercise.variants.length > 0 ? exercise.variants : normalizeVariants([], exerciseId);

const sameKey = (a: string, b: string): boolean => normalizeVariantName(a) === normalizeVariantName(b);

/**
 * Badge PR en direct pour chaque série validée d'un exercice.
 *
 * Référence = historique (`useHistoryIndex`, séries antérieures à la validation) via
 * `findPreviousBest` + `classify`. Une série déjà faite dans cette séance, même variante, avec
 * au moins autant de reps et de charge, retire le badge : il n'y a qu'un PR par niveau.
 */
export function livePrFlags(
  index: HistoryIndex,
  we: WorkoutExercise,
  exercise: Exercise | undefined,
  date: IsoDate,
): boolean[] {
  const done: { key: string; reps: number; weight: number }[] = [];
  return we.series.map((s: SerieEntry) => {
    if (!s.validated || !canValidate(s)) return false;
    const reps = parseReps(s.reps) ?? 0;
    const weight = parseWeight(s.kg) ?? 0;
    const at = s.validatedAt === null ? Number.NaN : Date.parse(s.validatedAt);
    const ref = findPreviousBest(
      index,
      we.exerciseId,
      {
        exerciseId: we.exerciseId,
        exerciseName: exercise?.name ?? we.name,
        ...resolveVariant(exercise, s.variantKey),
        reps,
        weight,
        performanceDate: date,
        createdAt: s.validatedAt,
      },
      { atTimestamp: Number.isFinite(at) ? at : Date.now() },
    );
    const improved = classify({ reps, weight }, ref).improvementStatus === 'improved';
    const beatenHere = done.some(
      (d) => sameKey(d.key, s.variantKey) && d.reps >= reps && d.weight >= weight - PR_EPSILON,
    );
    done.push({ key: s.variantKey, reps, weight });
    return improved && !beatenHere;
  });
}
