import { timeline } from '@/domain/cycles';
import { parseDateToIso, todayIso } from '@/domain/dates';
import type { CycleId, CycleState, IsoDate, Performance, Session } from '@/domain/model';
import type { PrKind } from '@/domain/records';
import { sessionCode, sessionsOfCycle } from '@/domain/sessions';

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

export type DaySession =
  | { kind: 'next'; session: Session; /** « A2 » : cycle + rang dans le cycle. */ code: string }
  | { kind: 'all-done'; cycle: CycleId }
  | { kind: 'no-cycle-session'; cycle: CycleId };

/** Première séance du cycle en cours (ordre Programme), avec au moins un exercice, non faite depuis lundi. */
export function nextPlannedSession(
  sessions: Session[],
  cycle: CycleId,
  perfs: Performance[],
  today: IsoDate,
): DaySession {
  const inCycle = sessionsOfCycle(sessions, cycle);
  // Une séance vide n'est pas une « séance du jour » ; son rang (code) reste celui du Programme.
  if (!inCycle.some((s) => s.exercises.length > 0)) return { kind: 'no-cycle-session', cycle };
  const from = weekStart(today);
  const done = new Set<string>();
  for (const p of perfs) {
    const day = parseDateToIso(p.performanceDate);
    if (day !== null && day >= from && day <= today) done.add(p.sessionName);
  }
  const index = inCycle.findIndex((s) => s.exercises.length > 0 && !done.has(s.name));
  const session = inCycle[index];
  return session ? { kind: 'next', session, code: sessionCode(cycle, index) } : { kind: 'all-done', cycle };
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
