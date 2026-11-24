import type { Exercise, Performance, Variant } from '@/domain/model';
import { normalizeVariantName } from '@/domain/names';
import { buildReport } from '@/domain/report';
import { normalizeVariants } from '@/domain/variants';
import { canValidate, type WorkoutState } from '@/domain/workout';

/** Clé de variante d'une série (même règle que le domaine) : id si connu, sinon nom. */
export const variantKeyOf = (v: Variant): string => v.id ?? v.name;

/** La variante correspond à la clé d'une série (id, ou nom normalisé). */
export const isSameVariant = (v: Variant, key: string): boolean =>
  (v.id !== null && v.id === key) || normalizeVariantName(v.name) === normalizeVariantName(key);

/** Variantes affichables : celles de l'exercice, sinon la variante par défaut. */
export const variantsOf = (exercise: Exercise | undefined, exerciseId: string): Variant[] =>
  exercise && exercise.variants.length > 0 ? exercise.variants : normalizeVariants([], exerciseId);

/**
 * Badges PR en direct : `flags[ex][serie]`.
 *
 * Calculés par `buildReport` lui-même (ordre réel de validation, séries précédentes de la séance,
 * historique antérieur au début de séance) : le badge en direct et le compte rendu concordent
 * toujours. `history` ne contient pas encore cette séance (elle n'est envoyée qu'à « Terminer »).
 */
export function livePrFlags(state: WorkoutState, history: Performance[], exercises: Exercise[]): boolean[][] {
  const report = buildReport(state, history, exercises);
  const flags = state.exercises.map((we) => we.series.map(() => false));
  // buildReport ne garde, dans l'ordre de la séance, que les exercices ayant une série valide.
  let k = 0;
  state.exercises.forEach((we, ex) => {
    if (!we.series.some((s) => s.validated && canValidate(s))) return;
    const reported = report.exercises[k];
    k += 1;
    for (const s of reported?.series ?? []) {
      const row = flags[ex];
      if (row && s.isPr) row[s.n - 1] = true;
    }
  });
  return flags;
}
