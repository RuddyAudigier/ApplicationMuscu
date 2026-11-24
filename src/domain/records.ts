import { parseDateToIso, performanceTimestamp } from './dates';
import type { ComparisonType, Id, IsoDate, Performance, Reference, ShareSerie } from './model';
import { normalizeExerciseName, normalizeVariantName } from './names';
import { round2, toNumber } from './numbers';
import { sameVariant } from './variants';

/** Tolérance anti faux PR / faux « en-dessous » dus aux arrondis. */
export const PR_EPSILON = 0.01;

/** `variantId` / `variantName` : identité de la perf source, filtrée par `sameVariant` à la lecture. */
interface Candidate {
  reps: number; weight: number; date: IsoDate; timestamp: number;
  variantId: Id | null; variantName: string;
}

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

const sameIdentity = (a: Candidate, b: Candidate): boolean =>
  a.variantId === b.variantId && normalizeVariantName(a.variantName) === normalizeVariantName(b.variantName);

/**
 * Ajoute des perfs à l'index. `compact` (insertion chronologique uniquement) écarte, à reps égales
 * et même variante, les candidats plus légers de plus de ε que le nouveau : ils sont dominés par
 * lui et ne peuvent plus être ni référence ni dominant, le résultat de `findPreviousBest` est inchangé.
 */
function addToIndex(index: Map<string, Map<number, Candidate[]>>, perfs: Performance[], compact: boolean): void {
  for (const p of perfs) {
    const reps = toNumber(p.reps);
    const weight = toNumber(p.weight);
    const date = parseDateToIso(p.performanceDate);
    const timestamp = performanceTimestamp(p);
    const exKeys = exerciseKeys(p.exerciseId, p);
    if (exKeys.length === 0 || date === null || timestamp === null) continue;
    if (reps === null || reps <= 0 || weight === null || weight < 0) continue;
    const candidate: Candidate = { reps, weight, date, timestamp, variantId: p.variantId, variantName: p.variantName };
    for (const varKey of variantKeys(p)) {
      for (const exKey of exKeys) {
        const baseKey = `${exKey}::${varKey}`;
        let repsMap = index.get(baseKey);
        if (!repsMap) {
          repsMap = new Map();
          index.set(baseKey, repsMap);
        }
        const list = repsMap.get(reps) ?? [];
        if (!compact) {
          list.push(candidate);
          repsMap.set(reps, list);
          continue;
        }
        const same = list.filter((c) => sameIdentity(c, candidate));
        // Déjà battu à ces reps, ou même charge déjà connue au même instant.
        if (same.some((c) => c.weight > weight + PR_EPSILON || (c.weight === weight && c.timestamp >= timestamp))) continue;
        // Retire les plus légers (dominés) et la même charge plus ancienne (le plus récent l'emporte).
        const kept = list.filter((c) => !(sameIdentity(c, candidate) && (c.weight < weight - PR_EPSILON || c.weight === weight)));
        kept.push(candidate);
        repsMap.set(reps, kept);
      }
    }
  }
}

/** Indexe tout l'historique sous chaque combinaison exercice × variante. O(n). */
export function buildHistoryIndex(perfs: Performance[]): HistoryIndex {
  const index = new Map<string, Map<number, Candidate[]>>();
  addToIndex(index, perfs, false);
  return index as HistoryIndex;
}

/**
 * Charge max ; parmi les charges à ≤ 0,01 de ce max, la plus récente l'emporte (puis la plus lourde).
 * Indépendant de l'ordre des candidats (le `reduce` legacy en dépendait quand deux charges
 * différaient de moins de ε) : l'index complet et l'index incrémental de `latestPrs` concordent.
 */
function pickHeaviest(candidates: Candidate[]): Candidate | null {
  let max = -Infinity;
  for (const c of candidates) if (c.weight > max) max = c.weight;
  let best: Candidate | null = null;
  for (const c of candidates) {
    if (c.weight < max - PR_EPSILON) continue;
    if (best === null || c.timestamp > best.timestamp || (c.timestamp === best.timestamp && c.weight > best.weight)) {
      best = c;
    }
  }
  return best;
}

/**
 * Candidats de toutes les clés exercice × variante, sans doublon. Un même candidat est indexé
 * sous plusieurs clés (même objet) : dédoublonnage par identité, les copies de même valeur
 * (reps, charge, date, horodatage) n'ont aucun effet sur la référence choisie.
 */
function findAllCandidates(index: HistoryIndex, exKeys: string[], p: Identity): Candidate[] {
  const seen = new Set<Candidate>();
  const varKeys = variantKeys(p);
  // Les clés id/nom ne font que présélectionner : `sameVariant` tranche (même règle que le tableau).
  const target = { id: p.variantId, name: p.variantName };
  for (const exKey of exKeys) {
    for (const varKey of varKeys) {
      const repsMap = index.get(`${exKey}::${varKey}`);
      if (!repsMap) continue;
      for (const list of repsMap.values()) {
        for (const c of list) if (!seen.has(c) && sameVariant(c, target)) seen.add(c);
      }
    }
  }
  return Array.from(seen);
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
 *
 * Règle utilisateur (prime sur la parité legacy) : un PR = plus de charge à reps égales, ou plus
 * de reps à charge égale. Voir les étapes ci-dessous ; écarts legacy documentés dans le test golden.
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
  const current = { reps, weight };
  // Mêmes reps : la plus lourde de TOUT l'historique, pas seulement la frontière (C4).
  const exact = pickHeaviest(previous.filter((c) => c.reps === reps));

  // 1. Dominée par une série antérieure → « en dessous », quel que soit l'ordre des étapes (Q2).
  // Frontière (O(n²)) calculée seulement sur les sous-ensembles utiles, pas sur tout l'historique.
  const dominators = previous.filter((c) => dominates(c, current));
  if (dominators.length > 0) {
    if (exact && exact.weight > weight + PR_EPSILON) return withType(exact, 'same-reps');
    // Un record (frontière) qui domine : reps les plus proches, puis la plus légère, puis la plus récente.
    const onFrontier = dominators.filter((c) => !isObsoleteReference(c, previous));
    const pool = onFrontier.length > 0 ? onFrontier : dominators;
    const closest = pool.sort((a, b) => {
      if (a.reps !== b.reps) return a.reps - b.reps;
      if (a.weight !== b.weight) return a.weight - b.weight;
      return b.timestamp - a.timestamp;
    })[0];
    if (closest) return withType(closest, 'higher-reps');
  }

  // 2. Mêmes reps (PR charge / égalé).
  if (exact) return withType(exact, 'same-reps');

  // 3. Rep inférieure la plus proche sur la frontière de Pareto (PR reps / hybride).
  const lowerFrontier = previous.filter((c) => c.reps < reps && !isObsoleteReference(c, previous));
  for (let lower = reps - 1; lower >= 1; lower -= 1) {
    const lowerBest = pickHeaviest(lowerFrontier.filter((c) => c.reps === lower));
    if (lowerBest) return withType(lowerBest, 'lower-reps');
  }
  return null;
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

export type PrKind = 'charge' | 'reps' | 'hybride';
export interface RecentPr {
  key: string;
  exerciseName: string;
  variantName: string;
  reps: number;
  weight: number;
  date: IsoDate;
  kind: PrKind;
}

/** Type de PR d'une classification, `null` si ce n'est pas un PR. */
export function prKind(c: Classification): PrKind | null {
  if (c.improvementStatus !== 'improved') return null;
  return c.isHybridPr ? 'hybride' : c.isRepsPr ? 'reps' : 'charge';
}

/**
 * Les `limit` PR les plus récents, du plus récent au plus ancien : même règle que
 * `findPreviousBest` + `classify`, sur un index construit au fil de l'eau (ordre chronologique)
 * et compacté (seuls les candidats non battus à reps égales restent), donc quasi linéaire.
 */
export function latestPrs(perfs: Performance[], limit = 3): RecentPr[] {
  const valid = perfs
    .map((p) => ({ p, ts: performanceTimestamp(p), date: parseDateToIso(p.performanceDate) }))
    .filter((x): x is { p: Performance & { weight: number }; ts: number; date: IsoDate } =>
      x.ts !== null && x.date !== null && x.p.weight !== null && x.p.weight >= 0 && x.p.reps > 0)
    .sort((a, b) => a.ts - b.ts);
  const index = new Map<string, Map<number, Candidate[]>>();
  const found: RecentPr[] = [];
  // Les lignes de même horodatage ne se voient pas (comparaison stricte) : traitées par lot.
  for (let i = 0; i < valid.length;) {
    let j = i;
    while (j < valid.length && valid[j]?.ts === valid[i]?.ts) j += 1;
    const batch = valid.slice(i, j);
    for (const { p, date } of batch) {
      const kind = prKind(classify({ reps: p.reps, weight: p.weight }, findPreviousBest(index as HistoryIndex, p.exerciseId, p)));
      if (kind) {
        found.push({ key: p.id, exerciseName: p.exerciseName, variantName: p.variantName, reps: p.reps, weight: p.weight, date, kind });
      }
    }
    addToIndex(index, batch.map((x) => x.p), true);
    i = j;
  }
  return found.reverse().slice(0, limit);
}
