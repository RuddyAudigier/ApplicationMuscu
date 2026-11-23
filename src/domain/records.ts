import { parseDateToIso, performanceTimestamp } from './dates';
import type { ComparisonType, Id, IsoDate, Performance, Reference, ShareSerie } from './model';
import { normalizeExerciseName, normalizeVariantName } from './names';
import { round2, toNumber } from './numbers';

/** Tolérance anti faux PR / faux « en-dessous » dus aux arrondis. */
export const PR_EPSILON = 0.01;

interface Candidate { reps: number; weight: number; date: IsoDate; timestamp: number }

declare const historyIndexBrand: unique symbol;
/** Index opaque : `"exKey::varKey" → reps → candidats` (INV §3.11). */
export type HistoryIndex = Map<string, Map<number, Candidate[]>> & { readonly [historyIndexBrand]: true };

type Identity = Pick<Performance, 'exerciseName' | 'variantId' | 'variantName'>;
type PerfLike = Pick<
  Performance,
  'exerciseId' | 'exerciseName' | 'variantId' | 'variantName' | 'reps' | 'weight' | 'performanceDate' | 'createdAt'
>;

function variantKeys(p: Identity): string[] {
  const keys: string[] = [];
  if (p.variantId) keys.push(`id:${p.variantId}`);
  keys.push(`name:${normalizeVariantName(p.variantName)}`);
  return keys;
}

function exerciseKeys(exerciseId: Id | null, p: Identity): string[] {
  const keys: string[] = [];
  if (exerciseId) keys.push(`id:${exerciseId}`);
  const name = normalizeExerciseName(p.exerciseName);
  if (name) keys.push(`name:${name}`);
  return keys;
}

/** Indexe tout l'historique sous chaque combinaison exercice × variante. O(n). */
export function buildHistoryIndex(perfs: Performance[]): HistoryIndex {
  const index = new Map<string, Map<number, Candidate[]>>();
  for (const p of perfs) {
    const reps = toNumber(p.reps);
    const weight = toNumber(p.weight);
    const date = parseDateToIso(p.performanceDate);
    const timestamp = performanceTimestamp(p);
    const exKeys = exerciseKeys(p.exerciseId, p);
    if (exKeys.length === 0 || date === null || timestamp === null) continue;
    if (reps === null || reps <= 0 || weight === null || weight < 0) continue;
    const candidate: Candidate = { reps, weight, date, timestamp };
    for (const varKey of variantKeys(p)) {
      for (const exKey of exKeys) {
        const baseKey = `${exKey}::${varKey}`;
        let repsMap = index.get(baseKey);
        if (!repsMap) {
          repsMap = new Map();
          index.set(baseKey, repsMap);
        }
        const list = repsMap.get(reps);
        if (list) list.push(candidate);
        else repsMap.set(reps, [candidate]);
      }
    }
  }
  return index as HistoryIndex;
}

/** Charge max ; à ≤ 0,01 près, la plus récente l'emporte (ordre du `reduce` legacy). */
function pickHeaviest(candidates: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const c of candidates) {
    if (
      best === null ||
      c.weight > best.weight ||
      (Math.abs(c.weight - best.weight) <= PR_EPSILON && c.timestamp > best.timestamp)
    ) {
      best = c;
    }
  }
  return best;
}

function dedupe(candidates: Candidate[]): Candidate[] {
  const unique = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${String(c.reps)}::${String(c.weight)}::${c.date}::${String(c.timestamp)}`;
    if (!unique.has(key)) unique.set(key, c);
  }
  return Array.from(unique.values());
}

function findAllCandidates(index: HistoryIndex, exKeys: string[], p: Identity): Candidate[] {
  const merged: Candidate[] = [];
  const varKeys = variantKeys(p);
  for (const exKey of exKeys) {
    for (const varKey of varKeys) {
      const repsMap = index.get(`${exKey}::${varKey}`);
      if (!repsMap) continue;
      for (const list of repsMap.values()) merged.push(...list);
    }
  }
  return dedupe(merged);
}

/** `o` domine `c` : au moins autant de reps et de charge (−ε), strictement plus sur un axe (+ε). */
const dominates = (o: { reps: number; weight: number }, c: { reps: number; weight: number }): boolean =>
  o.reps >= c.reps &&
  o.weight >= c.weight - PR_EPSILON &&
  (o.reps > c.reps || o.weight > c.weight + PR_EPSILON);

function isObsoleteReference(candidate: Candidate, all: Candidate[]): boolean {
  return all.some((o) => o !== candidate && dominates(o, candidate));
}

const withType = (c: Candidate, comparisonType: ComparisonType): Reference => ({ ...c, comparisonType });

/**
 * Référence précédente (timestamp strictement inférieur) pour comparer une série (INV §3.11).
 * `opts.atTimestamp` remplace le timestamp de la perf (détection en direct, D2).
 */
export function findPreviousBest(
  index: HistoryIndex,
  exerciseId: Id | null,
  perf: PerfLike,
  opts?: { atTimestamp?: number },
): Reference | null {
  const reps = toNumber(perf.reps);
  const weight = toNumber(perf.weight);
  const now = opts?.atTimestamp ?? performanceTimestamp(perf);
  const exKeys = exerciseKeys(exerciseId, perf);
  if (exKeys.length === 0 || !reps || reps <= 0 || weight === null || now === null || !Number.isFinite(now)) {
    return null;
  }

  const previous = findAllCandidates(index, exKeys, perf).filter((c) => c.timestamp < now);
  const frontier = previous.filter((c) => !isObsoleteReference(c, previous));

  const exact = pickHeaviest(frontier.filter((c) => c.reps === reps));
  if (exact) return withType(exact, 'same-reps');

  for (let lower = reps - 1; lower >= 1; lower -= 1) {
    const lowerBest = pickHeaviest(frontier.filter((c) => c.reps === lower));
    if (lowerBest) return withType(lowerBest, 'lower-reps');
  }

  const current = { reps, weight };
  const dominating = frontier
    .filter((c) => dominates(c, current))
    .sort((a, b) => {
      if (a.reps !== b.reps) return a.reps - b.reps;
      if (a.weight !== b.weight) return a.weight - b.weight;
      return b.timestamp - a.timestamp;
    })[0];
  return dominating ? withType(dominating, 'higher-reps') : null;
}

type Classification = Pick<
  ShareSerie,
  'improvementStatus' | 'improvementDelta' | 'improvementDeltaReps' | 'isHybridPr' | 'isRepsPr'
>;

/** Classement d'une série valide face à sa référence (INV §3.10.5). */
export function classify(perf: { reps: number; weight: number }, ref: Reference | null): Classification {
  if (ref === null) {
    return { improvementStatus: 'data-capture', improvementDelta: null, improvementDeltaReps: null, isHybridPr: false, isRepsPr: false };
  }
  const dw = perf.weight - ref.weight;
  const base = { improvementDelta: round2(dw), improvementDeltaReps: round2(perf.reps - ref.reps), isHybridPr: false, isRepsPr: false };
  const up = dw > PR_EPSILON;
  const same = Math.abs(dw) <= PR_EPSILON;
  switch (ref.comparisonType) {
    case 'same-reps':
      return { ...base, improvementStatus: up ? 'improved' : same ? 'equaled' : 'below' };
    case 'lower-reps':
      if (up) return { ...base, improvementStatus: 'improved', isHybridPr: true };
      if (same) return { ...base, improvementStatus: 'improved', isRepsPr: true };
      return { ...base, improvementStatus: 'data-capture' };
    case 'higher-reps':
      return { ...base, improvementStatus: 'below' };
  }
}
