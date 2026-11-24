import { timeline } from '@/domain/cycles';
import { parseDateToIso, performanceTimestamp, todayIso } from '@/domain/dates';
import type { CycleId, CycleState, IsoDate, Performance, Session } from '@/domain/model';
import { normalizeExerciseName, normalizeVariantName } from '@/domain/names';
import { classify, PR_EPSILON } from '@/domain/records';

const DAY_MS = 86_400_000;
/** Durée supposée des blocs passés / futurs (la prolongation ne concerne que le bloc en cours). */
const STANDARD_WEEKS = 2;

const localDate = (iso: IsoDate): Date => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Lundi (ISO) de la semaine de `today`. */
export function weekStart(today: IsoDate): IsoDate {
  const d = localDate(today);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return todayIso(d);
}

/** Ordre du Programme : date de création, puis id. */
const byCreation = (a: Session, b: Session): number =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export type DaySession =
  | { kind: 'next'; session: Session; /** « A2 » : cycle + rang dans le cycle. */ code: string }
  | { kind: 'all-done'; cycle: CycleId }
  | { kind: 'no-cycle-session'; cycle: CycleId };

/** Première séance du cycle en cours (ordre Programme) non faite depuis lundi. */
export function sessionOfDay(
  sessions: Session[],
  cycle: CycleId,
  perfs: Performance[],
  today: IsoDate,
): DaySession {
  const inCycle = sessions.filter((s) => s.cycle === cycle).sort(byCreation);
  if (inCycle.length === 0) return { kind: 'no-cycle-session', cycle };
  const from = weekStart(today);
  const done = new Set<string>();
  for (const p of perfs) {
    const day = parseDateToIso(p.performanceDate);
    if (day !== null && day >= from && day <= today) done.add(p.sessionName);
  }
  const index = inCycle.findIndex((s) => !done.has(s.name));
  const session = inCycle[index];
  return session ? { kind: 'next', session, code: `${cycle}${String(index + 1)}` } : { kind: 'all-done', cycle };
}

export interface WeekSegment {
  cycle: CycleId;
  status: 'past' | 'current' | 'future';
  /** Remplissage 0..1 de la semaine. */
  fill: number;
}

/** Frise semaine par semaine : bloc précédent, bloc en cours, bloc suivant (cf. maquette). */
export function weekSegments(state: CycleState, today: IsoDate, weeks: number): WeekSegment[] {
  const [, past, current, future] = timeline(state, today, 4);
  const out: WeekSegment[] = [];
  if (past) for (let i = 0; i < STANDARD_WEEKS; i += 1) out.push({ cycle: past.cycle, status: 'past', fill: 1 });
  if (current) {
    for (let i = 0; i < weeks; i += 1) {
      const fill = Math.min(1, Math.max(0, current.progress * weeks - i));
      out.push({ cycle: current.cycle, status: 'current', fill });
    }
  }
  if (future) for (let i = 0; i < STANDARD_WEEKS; i += 1) out.push({ cycle: future.cycle, status: 'future', fill: 0 });
  return out;
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

/** Union-find : regroupe les lignes qui partagent une clé exercice × variante (id ou nom, comme l'index du domaine). */
function groupOf(perfs: Performance[]): string[] {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    for (let up = parent.get(r); up !== undefined && up !== r; up = parent.get(r)) r = up;
    parent.set(k, r);
    return r;
  };
  // Les identités se répètent beaucoup : normalisation une fois par identité distincte.
  const keyCache = new Map<string, string[]>();
  const keysOf = (p: Performance): string[] => {
    const identity = `${p.exerciseId ?? ''}\u0000${p.exerciseName}\u0000${p.variantId ?? ''}\u0000${p.variantName}`;
    const cached = keyCache.get(identity);
    if (cached) return cached;
    const ex: string[] = [];
    if (p.exerciseId) ex.push(`id:${p.exerciseId}`);
    const name = normalizeExerciseName(p.exerciseName);
    if (name) ex.push(`name:${name}`);
    const vars = [...(p.variantId ? [`id:${p.variantId}`] : []), `name:${normalizeVariantName(p.variantName)}`];
    const keys = ex.flatMap((e) => vars.map((v) => `${e}::${v}`));
    keyCache.set(identity, keys);
    return keys;
  };
  const firsts = perfs.map((p) => {
    const keys = keysOf(p);
    for (const k of keys) if (!parent.has(k)) parent.set(k, k);
    const [first] = keys;
    if (first !== undefined) for (const k of keys) parent.set(find(k), find(first));
    return first;
  });
  return firsts.map((first) => (first === undefined ? '' : find(first)));
}

/** Meilleure charge par nombre de reps (plus récente à ε près, comme `pickHeaviest`). */
type Bests = Map<number, number>;

/**
 * Classement d'une série face aux records antérieurs, même règle que `findPreviousBest` + `classify`
 * mais sur la frontière de Pareto maintenue par groupe (≤ ~30 entrées) au lieu de tout l'historique.
 */
function prKindOf(reps: number, weight: number, bests: Bests): PrKind | null {
  const sorted = [...bests.entries()].sort((a, b) => b[0] - a[0]);
  const frontier = new Map<number, number>();
  let maxAbove = -Infinity;
  for (const [r, w] of sorted) {
    if (maxAbove < w - PR_EPSILON) frontier.set(r, w);
    maxAbove = Math.max(maxAbove, w);
  }
  for (let r = reps; r >= 1; r -= 1) {
    const w = frontier.get(r);
    if (w === undefined) continue;
    const comparisonType = r === reps ? 'same-reps' : 'lower-reps';
    const c = classify({ reps, weight }, { reps: r, weight: w, date: '', timestamp: 0, comparisonType });
    if (c.improvementStatus !== 'improved') return null;
    return c.isHybridPr ? 'hybride' : c.isRepsPr ? 'reps' : 'charge';
  }
  return null; // référence à plus de reps (en dessous) ou aucune (prise de données)
}

/**
 * Les `limit` PR les plus récents, du plus récent au plus ancien.
 * Une passe chronologique par groupe : O(n log n + n·R log R), R = nombre de reps distinctes.
 */
export function latestPrs(perfs: Performance[], limit = 3): RecentPr[] {
  const valid = perfs
    .map((p) => ({ p, ts: performanceTimestamp(p), date: parseDateToIso(p.performanceDate) }))
    .filter((x): x is { p: Performance & { weight: number }; ts: number; date: IsoDate } =>
      x.ts !== null && x.date !== null && x.p.weight !== null && x.p.weight >= 0 && x.p.reps > 0)
    .sort((a, b) => a.ts - b.ts);
  const groups = groupOf(valid.map((x) => x.p));
  const bestsByGroup = new Map<string, Bests>();
  const found: RecentPr[] = [];
  // Les lignes de même horodatage ne se voient pas (comparaison stricte du domaine) : traitées par lot.
  for (let i = 0; i < valid.length;) {
    let j = i;
    while (j < valid.length && valid[j]?.ts === valid[i]?.ts) j += 1;
    const batch = valid.slice(i, j).map((x, k) => ({ ...x, g: groups[i + k] ?? '' }));
    for (const { p, date, g } of batch) {
      const kind = prKindOf(p.reps, p.weight, bestsByGroup.get(g) ?? new Map<number, number>());
      if (kind) {
        found.push({ key: p.id, exerciseName: p.exerciseName, variantName: p.variantName, reps: p.reps, weight: p.weight, date, kind });
      }
    }
    for (const { p, g } of batch) {
      let bests = bestsByGroup.get(g);
      if (!bests) {
        bests = new Map();
        bestsByGroup.set(g, bests);
      }
      const cur = bests.get(p.reps);
      if (cur === undefined || p.weight > cur || Math.abs(p.weight - cur) <= PR_EPSILON) bests.set(p.reps, p.weight);
    }
    i = j;
  }
  return found.reverse().slice(0, limit);
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « aujourd'hui », « hier », jour de la semaine sur 7 jours, sinon JJ/MM. */
export function relativeDay(date: IsoDate, today: IsoDate): string {
  const diff = Math.round((localDate(today).getTime() - localDate(date).getTime()) / DAY_MS);
  if (diff === 0) return 'aujourd’hui';
  if (diff === 1) return 'hier';
  if (diff > 1 && diff < 7) return WEEKDAYS[localDate(date).getDay()] ?? date;
  const [, m = '', d = ''] = date.split('-');
  return `${d}/${m}`;
}

export const PR_LABEL: Record<PrKind, string> = {
  charge: 'Record charge',
  reps: 'Record reps',
  hybride: 'PR hybride',
};
