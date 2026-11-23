import { timeline } from '@/domain/cycles';
import { parseDateToIso, performanceTimestamp, todayIso } from '@/domain/dates';
import type { CycleId, CycleState, IsoDate, Performance, Session } from '@/domain/model';
import { classify, findPreviousBest, type HistoryIndex } from '@/domain/records';

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

const byName = (a: Session, b: Session): number => a.name.localeCompare(b.name, 'fr', { numeric: true });

export type DaySession =
  | { kind: 'next'; session: Session }
  | { kind: 'all-done'; cycle: CycleId }
  | { kind: 'no-cycle-session'; cycle: CycleId };

/** Prochaine séance du cycle en cours (ordre des noms) non faite depuis lundi. */
export function sessionOfDay(
  sessions: Session[],
  cycle: CycleId,
  perfs: Performance[],
  today: IsoDate,
): DaySession {
  const inCycle = sessions.filter((s) => s.cycle === cycle).sort(byName);
  if (inCycle.length === 0) return { kind: 'no-cycle-session', cycle };
  const from = weekStart(today);
  const done = new Set<string>();
  for (const p of perfs) {
    const day = parseDateToIso(p.performanceDate);
    if (day !== null && day >= from && day <= today) done.add(p.sessionName);
  }
  const next = inCycle.find((s) => !done.has(s.name));
  return next ? { kind: 'next', session: next } : { kind: 'all-done', cycle };
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

/** Les `limit` PR les plus récents (règle `findPreviousBest` + `classify`), du plus récent au plus ancien. */
export function latestPrs(perfs: Performance[], index: HistoryIndex, limit = 3): RecentPr[] {
  const dated = perfs
    .map((p) => ({ p, ts: performanceTimestamp(p), date: parseDateToIso(p.performanceDate) }))
    .filter((x): x is { p: Performance; ts: number; date: IsoDate } => x.ts !== null && x.date !== null)
    .sort((a, b) => b.ts - a.ts);
  const out: RecentPr[] = [];
  for (const { p, date } of dated) {
    if (out.length >= limit) break;
    if (p.weight === null || p.reps <= 0) continue;
    const c = classify({ reps: p.reps, weight: p.weight }, findPreviousBest(index, p.exerciseId, p));
    if (c.improvementStatus !== 'improved') continue;
    const kind: PrKind = c.isHybridPr ? 'hybride' : c.isRepsPr ? 'reps' : 'charge';
    out.push({
      key: p.id,
      exerciseName: p.exerciseName,
      variantName: p.variantName,
      reps: p.reps,
      weight: p.weight,
      date,
      kind,
    });
  }
  return out;
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
