import { e1rm, roundE1rm } from '@/domain/e1rm';
import type { CycleId, Exercise, ExerciseDraft, Id, Performance, Session, Variant } from '@/domain/model';
import { matchesQuery, muscleKey, muscleKeys } from '@/domain/muscles';
import { normalizeSearch } from '@/domain/names';
import { formatWeight } from '@/domain/numbers';
import { bestByReps, paretoMask } from '@/domain/perfTable';
import { DEFAULT_VARIANT, sameVariant, variantLabel } from '@/domain/variants';

/** Cycles (A puis B) des séances qui contiennent l'exercice. Un exercice peut être dans les deux. */
export function cyclesFor(exerciseId: Id, sessions: Session[]): CycleId[] {
  const found = new Set<CycleId>();
  for (const s of sessions) {
    if (s.cycle && s.exercises.some((e) => e.exerciseId === exerciseId)) found.add(s.cycle);
  }
  return (['A', 'B'] as const).filter((c) => found.has(c));
}

/** Vrai si l'exercice travaille ce muscle (alias compris : « Pectoraux » ↔ « Pecs »). */
export function worksMuscle(e: Pick<Exercise, 'muscleGroups'>, muscle: string): boolean {
  const key = muscleKey(muscle);
  const target = normalizeSearch(muscle);
  return e.muscleGroups.some((g) => normalizeSearch(g) === target || (key !== null && muscleKeys(g).includes(key)));
}

/** Recherche (sans accents, alias de muscles) puis filtre muscle (`null` = tous). */
export function filterExercises<T extends Pick<Exercise, 'name' | 'muscleGroups'>>(
  list: T[],
  query: string,
  muscle: string | null,
): T[] {
  return list.filter((e) => matchesQuery(e, query) && (muscle === null || worksMuscle(e, muscle)));
}

export interface VariantStat {
  variant: Variant;
  label: string;
  /** Records affichés dans le tableau (cases non dominées). */
  records: number;
  /** Meilleur e1RM (Epley) arrondi au dixième, `null` sans perf. */
  bestE1rm: number | null;
}

/** Stats par variante, avec la même appartenance que le tableau des records. */
export function variantStats(exercise: Exercise, perfs: Performance[]): VariantStat[] {
  const own = perfs.filter((p) => p.exerciseId === exercise.id);
  return exercise.variants.map((variant) => {
    const cells = bestByReps(own, variant);
    let best = 0;
    for (const p of cells) {
      const v = p ? e1rm(p.weight, p.reps) : null;
      if (v !== null && v > best) best = v;
    }
    return {
      variant,
      label: variantLabel(variant.name),
      records: paretoMask(cells).filter((p) => p !== null).length,
      bestE1rm: best > 0 ? roundE1rm(best) : null,
    };
  });
}

const nameKey = (name: string): string => normalizeSearch(variantLabel(name.trim())).replace(/\s+/g, ' ');

/** Identité stable d'une variante : son id, sinon son nom (base sans table de variantes). */
export function variantKey(v: Variant): string {
  return v.id ?? `name:${v.name}`;
}

/**
 * Valide un nom de variante (D11 : un nom déjà pris est refusé avec message).
 * « Classique » et « Touch and Go » désignent la variante par défaut.
 * `exceptKey` : la variante renommée (son propre nom ne compte pas).
 */
export function variantNameError(name: string, variants: Variant[], exceptKey: string | null = null): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Donne un nom à la variante.';
  const key = nameKey(trimmed);
  const taken = variants.some((v) => variantKey(v) !== exceptKey && nameKey(v.name) === key);
  return taken ? 'Une variante porte déjà ce nom.' : null;
}

/** Renomme la variante `key` (les autres restent inchangées). */
export function renameVariant(variants: Variant[], key: string, name: string): Variant[] {
  return variants.map((v) => (variantKey(v) === key ? { ...v, name: name.trim() } : v));
}

/** Retire la variante `key` ; la variante par défaut n'est jamais retirée. */
export function removeVariant(variants: Variant[], key: string): Variant[] {
  return variants.filter((v) => v.isDefault || variantKey(v) !== key);
}

/** Brouillon complet à envoyer au repo : seules les variantes changent. */
export function draftWith(exercise: Exercise, variants: Variant[]): ExerciseDraft {
  return {
    name: exercise.name,
    description: exercise.description,
    muscleGroups: exercise.muscleGroups,
    variants,
  };
}

/** Nouvelle variante : id `null`, le repo renvoie l'id réel (D11). */
export function newVariant(exercise: Exercise, name: string): Variant {
  return { id: null, exerciseId: exercise.id, name: name.trim(), isDefault: false };
}

/** Brouillon de création : la variante par défaut (« Classique ») est créée d'office. */
export function createDraft(name: string, muscleGroups: string[], description = ''): ExerciseDraft {
  return {
    name: name.trim(),
    description: description.trim(),
    muscleGroups,
    variants: [{ id: null, exerciseId: null, name: DEFAULT_VARIANT, isDefault: true }],
  };
}

export interface ExerciseInfo {
  name: string;
  description: string;
  muscleGroups: string[];
}

/** Brouillon complet de la fiche modifiée : les variantes restent celles de l'exercice. */
export function infoDraft(exercise: Exercise, info: ExerciseInfo): ExerciseDraft {
  return {
    name: info.name.trim(),
    description: info.description.trim(),
    muscleGroups: info.muscleGroups,
    variants: exercise.variants,
  };
}

/*
 * C2 : on ne sait pas si la base supprime en cascade les performances d'un exercice ou d'une
 * variante supprimés. Tant que ce n'est pas vérifié, la suppression est refusée dès qu'il existe
 * une performance (identité perf ↔ variante identique au tableau des records).
 */

/** L'exercice a au moins une performance enregistrée. */
export function hasExercisePerformances(exerciseId: Id, perfs: Performance[]): boolean {
  return perfs.some((p) => p.exerciseId === exerciseId);
}

/** La variante de cet exercice a au moins une performance enregistrée. */
export function hasVariantPerformances(exerciseId: Id, variant: Variant, perfs: Performance[]): boolean {
  return perfs.some((p) => p.exerciseId === exerciseId && sameVariant(p, variant));
}

/** Erreur brute précédée d'un contexte en français : « Suppression impossible : … ». */
export function errorText(prefix: string, error: Error): string {
  return error.message ? `${prefix} : ${error.message}` : `${prefix}.`;
}

/** « 27,5 kg » ; « — » sans perf. */
export function formatKg(v: number | null): string {
  return v === null ? '—' : `${formatWeight(v)} kg`;
}

/** « Par défaut · 14 records », « 1 record », « Aucun record ». */
export function variantMeta(stat: VariantStat): string {
  const count = stat.records === 0 ? 'Aucun record' : `${String(stat.records)} record${stat.records > 1 ? 's' : ''}`;
  return stat.variant.isDefault ? `Par défaut · ${count}` : count;
}
