import { cycleOn } from './cycles';
import { parseDateToIso } from './dates';
import type { CycleId, CycleState, Id, IsoDate, Performance, PlanOverride, Session, WeekPlan } from './model';
import { normalizeSearch } from './names';
import { sessionCode, sessionsOfCycle } from './sessions';

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

const DAY_MS = 86_400_000;
const toDays = (iso: IsoDate): number => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};
const fromDays = (n: number): IsoDate => new Date(n * DAY_MS).toISOString().slice(0, 10);

export const addDays = (iso: IsoDate, n: number): IsoDate => fromDays(toDays(iso) + n);
/** 0 = lundi … 6 = dimanche. */
export const weekdayOf = (iso: IsoDate): number => (((toDays(iso) + 3) % 7) + 7) % 7;
/** Lundi de la semaine de `iso`. */
export const mondayOf = (iso: IsoDate): IsoDate => addDays(iso, -weekdayOf(iso));

const restWeek = (): (Id | null)[] => [null, null, null, null, null, null, null];
export const emptyWeekPlan = (): WeekPlan => ({ days: { A: restWeek(), B: restWeek() }, overrides: [] });

/** Au moins un jour d'entraînement réglé, dans l'un ou l'autre cycle. */
export const hasSchedule = (plan: WeekPlan | null | undefined): plan is WeekPlan =>
  !!plan && [...plan.days.A, ...plan.days.B].some((d) => d !== null);

export type OccurrenceStatus = 'done' | 'skipped' | 'missed' | 'today' | 'upcoming';

/** Séance prévue dans la semaine (après décalage éventuel). */
export interface Occurrence {
  /** Jour prévu dans la semaine type (0 = lundi) : identifie l'occurrence. */
  day: number;
  plannedDate: IsoDate;
  /** Date effective (décalée si besoin). */
  date: IsoDate;
  moved: boolean;
  session: Session;
  code: string;
  status: OccurrenceStatus;
}

/**
 * Séances de la semaine de `today`, triées par date effective.
 *
 * Une séance est « faite » si des perfs portent son nom un jour de la semaine (jusqu'à aujourd'hui) :
 * faite en avance, elle compte quand même. Une même séance prévue deux fois est consommée dans l'ordre.
 */
export function weekOccurrences(
  plan: WeekPlan,
  sessions: Session[],
  cycleState: CycleState,
  perfs: Pick<Performance, 'performanceDate' | 'sessionName'>[],
  today: IsoDate,
): Occurrence[] {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);

  // Jours (distincts) où chaque séance a été faite cette semaine.
  const doneDays = new Map<string, Set<IsoDate>>();
  for (const p of perfs) {
    const d = parseDateToIso(p.performanceDate);
    if (d === null || d < monday || d > sunday || d > today) continue;
    const key = normalizeSearch(p.sessionName);
    if (!doneDays.has(key)) doneDays.set(key, new Set());
    doneDays.get(key)?.add(d);
  }
  const doneCount = new Map<string, number>();
  for (const [k, days] of doneDays) doneCount.set(k, days.size);

  const raw: Omit<Occurrence, 'status'>[] = [];
  for (let day = 0; day < 7; day += 1) {
    const plannedDate = addDays(monday, day);
    // Cycle (re)démarré en milieu de semaine : les jours d'avant, dans cette même semaine,
    // suivent le cycle qui vient de démarrer (sinon le lundi basculerait sur l'autre cycle).
    const startsThisWeek = mondayOf(cycleState.startedOn) === monday && plannedDate < cycleState.startedOn;
    const cycle = cycleOn(cycleState, startsThisWeek ? cycleState.startedOn : plannedDate);
    const sessionId = plan.days[cycle][day] ?? null;
    if (sessionId === null) continue;
    const ofCycle = sessionsOfCycle(sessions, cycle);
    const rank = ofCycle.findIndex((s) => s.id === sessionId);
    const session = ofCycle[rank];
    // Séance supprimée ou changée de cycle : jour traité comme repos.
    if (!session || session.exercises.length === 0) continue;
    const ov = plan.overrides.find((o) => o.week === monday && o.day === day);
    const date = ov?.kind === 'moved' ? ov.date : plannedDate;
    raw.push({ day, plannedDate, date, moved: ov?.kind === 'moved', session, code: sessionCode(cycle, rank) });
  }
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.day - b.day));

  return raw.map((o) => {
    const skipped = plan.overrides.some((ov) => ov.week === monday && ov.day === o.day && ov.kind === 'skipped');
    if (skipped) return { ...o, status: 'skipped' };
    const key = normalizeSearch(o.session.name);
    const left = doneCount.get(key) ?? 0;
    if (left > 0) {
      doneCount.set(key, left - 1);
      return { ...o, status: 'done' };
    }
    const status: OccurrenceStatus = o.date < today ? 'missed' : o.date === today ? 'today' : 'upcoming';
    return { ...o, status };
  });
}

/** Séances manquées (passées, ni faites ni sautées) et prochaine séance à faire (aujourd'hui ou plus tard). */
export function weekAgenda(occurrences: Occurrence[]): { missed: Occurrence[]; next: Occurrence | null } {
  return {
    missed: occurrences.filter((o) => o.status === 'missed'),
    next: occurrences.find((o) => o.status === 'today' || o.status === 'upcoming') ?? null,
  };
}

/** Jours possibles pour décaler une séance : d'aujourd'hui à dimanche. */
export function moveTargets(today: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = today; d <= addDays(mondayOf(today), 6); d = addDays(d, 1)) out.push(d);
  return out;
}

/** Retire les exceptions des semaines passées et celle déjà posée sur cette occurrence. */
function withOverride(plan: WeekPlan, today: IsoDate, next: PlanOverride | null, day: number): WeekPlan {
  const monday = mondayOf(today);
  const kept = plan.overrides.filter((o) => o.week >= monday && !(o.week === monday && o.day === day));
  return { days: plan.days, overrides: next ? [...kept, next] : kept };
}

export const moveOccurrence = (plan: WeekPlan, today: IsoDate, day: number, date: IsoDate): WeekPlan =>
  withOverride(plan, today, date === addDays(mondayOf(today), day)
    ? null
    : { week: mondayOf(today), day, kind: 'moved', date }, day);

export const skipOccurrence = (plan: WeekPlan, today: IsoDate, day: number): WeekPlan =>
  withOverride(plan, today, { week: mondayOf(today), day, kind: 'skipped' }, day);

/** Annule le décalage ou le saut d'une occurrence de la semaine. */
export const resetOccurrence = (plan: WeekPlan, today: IsoDate, day: number): WeekPlan =>
  withOverride(plan, today, null, day);

/** Règle un jour de la semaine type d'un cycle ; les exceptions passées sont nettoyées au passage. */
export function setPlanDay(
  plan: WeekPlan,
  today: IsoDate,
  cycle: CycleId,
  day: number,
  sessionId: Id | null,
): WeekPlan {
  const days = { ...plan.days, [cycle]: plan.days[cycle].map((d, i) => (i === day ? sessionId : d)) };
  return { days, overrides: plan.overrides.filter((o) => o.week >= mondayOf(today)) };
}

/** « lundi 24 » */
export function dayLabel(iso: IsoDate): string {
  return `${(WEEKDAYS[weekdayOf(iso)] ?? '').toLowerCase()} ${String(Number(iso.slice(8, 10)))}`;
}
