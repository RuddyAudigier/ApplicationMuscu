import { cycleStatus, weeksForDays } from '@/domain/cycles';
import { parseDateToIso, todayIso } from '@/domain/dates';
import type { CycleId, CycleState, IsoDate, Performance, Session } from '@/domain/model';
import type { PrKind } from '@/domain/records';
import { sessionCode, sessionsOfCycle } from '@/domain/sessions';

const DAY_MS = 86_400_000;

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
  return session ? { kind: 'next', session, code: sessionCode(cycle) } : { kind: 'all-done', cycle };
}

export interface WeekSegment {
  cycle: CycleId;
  status: 'past' | 'current' | 'future';
  /** Remplissage 0..1 de la semaine. */
  fill: number;
}

/**
 * Frise semaine par semaine, à partir de la semaine en cours (surlignée) : semaines restantes du
 * bloc en cours, puis les blocs suivants (durée générale, en alternant), `total` segments en tout.
 */
export function weekSegments(state: CycleState, today: IsoDate, total = 6): WeekSegment[] {
  const status = cycleStatus(state, today);
  const out: WeekSegment[] = [{ cycle: status.current, status: 'current', fill: 1 }];
  for (let i = status.week; i < status.weeks && out.length < total; i += 1) {
    out.push({ cycle: status.current, status: 'future', fill: 0 });
  }
  const nextWeeks = weeksForDays(state.lengthDays);
  let cycle = status.next;
  while (out.length < total) {
    for (let i = 0; i < nextWeeks && out.length < total; i += 1) out.push({ cycle, status: 'future', fill: 0 });
    cycle = cycle === 'A' ? 'B' : 'A';
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
