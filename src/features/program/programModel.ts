import { cycleStatus, daysForWeeks, lengthLabel, nextBlockStart, postponedDays, weeksForDays } from '@/domain/cycles';
import type { CycleId, CycleState, Id, IsoDate, Performance, Session } from '@/domain/model';
import { plural } from '@/domain/text';
import { normalizeSearch } from '@/domain/names';

export const MIN_SERIES = 1;
export const MAX_SERIES = 6;
export const DEFAULT_SERIES = 3;

/** Séries modulables : la séance prévoit N séries, on peut s'arrêter à N−1 (« 2–3 séries »). */
export function seriesLabel(series: number): string {
  if (series <= 1) return '1 série';
  return `${String(series - 1)}–${String(series)} séries`;
}

/** Séances d'un cycle (A1, A2…) et leur code : implémentation unique du domaine. */
export { sessionCode, sessionsOfCycle } from '@/domain/sessions';

/** Une autre séance du même cycle porte déjà ce nom (trimé, sans casse ni accents). */
export function isDuplicateName(sessions: Session[], name: string, cycle: CycleId | null, selfId: Id | null): boolean {
  const key = normalizeSearch(name);
  return sessions.some((s) => s.id !== selfId && s.cycle === cycle && normalizeSearch(s.name) === key);
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: IsoDate): number => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

/** Date de la dernière performance enregistrée sous le nom de la séance, `null` sinon. */
export function lastDoneOn(perfs: Performance[], sessionName: string): IsoDate | null {
  let last: IsoDate | null = null;
  for (const p of perfs) {
    if (p.sessionName === sessionName && (last === null || p.performanceDate > last)) last = p.performanceDate;
  }
  return last;
}

export interface LastDone { isToday: boolean; label: string }

/** « Aujourd’hui », « Hier », « il y a N j » ; `null` si jamais faite. */
export function lastDoneLabel(date: IsoDate | null, today: IsoDate): LastDone | null {
  if (date === null) return null;
  const days = dayNumber(today) - dayNumber(date);
  if (days <= 0) return { isToday: true, label: 'Aujourd’hui' };
  if (days === 1) return { isToday: false, label: 'Hier' };
  return { isToday: false, label: `il y a ${String(days)} j` };
}

/** Libellé de l'onglet : « En cours » pour le cycle courant, sinon « dans N j ». */
export function tabCaption(state: CycleState, today: IsoDate, cycle: CycleId): string {
  const status = cycleStatus(state, today);
  return status.current === cycle ? 'En cours' : `dans ${String(status.daysLeft)} j`;
}

/** Durées proposées : 1 à 4 semaines par pas de 0,5 (en jours : 7, 11, 14, 18, 21, 25, 28). */
export const LENGTH_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4].map((w) => ({
  value: String(daysForWeeks(w)),
  label: `${String(w).replace('.', ',')} semaine${w >= 2 ? 's' : ''}`,
}));


/** « Prochain cycle B le jeudi 12 déc. » (+ « · reporté de N semaine(s) »). */
export function nextCycleLine(state: CycleState, today: IsoDate): string {
  const status = cycleStatus(state, today);
  const [y = 0, m = 1, d = 1] = nextBlockStart(state, today).split('-').map(Number);
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
    .format(new Date(y, m - 1, d));
  const extra = postponedDays(state, today);
  const postponed = extra > 0 ? ` · reporté de ${plural(weeksForDays(extra), 'semaine')}` : '';
  return `Prochain cycle ${status.next} le ${date}${postponed}`;
}

/** Aide quand l'onglet affiché n'est pas le cycle en cours. */
export function upcomingHint(state: CycleState, today: IsoDate, cycle: CycleId): string {
  const status = cycleStatus(state, today);
  const days = status.daysLeft === 1 ? '1 jour' : `${String(status.daysLeft)} jours`;
  return `${cycle} commence dans ${days}, pour ${lengthLabel(state.lengthDays)}. Le report et la durée se règlent depuis le cycle en cours.`;
}
