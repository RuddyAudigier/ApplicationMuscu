import { cycleStatus, extendCycle } from '@/domain/cycles';
import type { CycleId, CycleState, Id, IsoDate, Performance, Session } from '@/domain/model';
import { normalizeSearch } from '@/domain/names';

export const MIN_SERIES = 1;
export const MAX_SERIES = 6;
export const DEFAULT_SERIES = 3;

/** Séries modulables : la séance prévoit N séries, on peut s'arrêter à N−1 (« 2–3 séries »). */
export function seriesLabel(series: number): string {
  if (series <= 1) return '1 série';
  return `${String(series - 1)}–${String(series)} séries`;
}

/** Séances d'un cycle, de la plus ancienne à la plus récente (A1, A2…) ; égalité départagée par id. */
export function sessionsOfCycle(sessions: Session[], cycle: CycleId | null): Session[] {
  return sessions
    .filter((s) => s.cycle === cycle)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Une autre séance du même cycle porte déjà ce nom (trimé, sans casse ni accents). */
export function isDuplicateName(sessions: Session[], name: string, cycle: CycleId | null, selfId: Id | null): boolean {
  const key = normalizeSearch(name);
  return sessions.some((s) => s.id !== selfId && s.cycle === cycle && normalizeSearch(s.name) === key);
}

/** Revenir à 2 semaines alors que le bloc prolongé est en 3e semaine fait basculer tout de suite. */
export function revertSwitchesNow(state: CycleState, today: IsoDate): boolean {
  const status = cycleStatus(state, today);
  return status.weeks === 3 && status.week === 3;
}

/** Durée du bloc en cours : 3 semaines = prolongé, 2 = standard (même date de début). */
export function withCycleWeeks(state: CycleState, today: IsoDate, weeks: 2 | 3): CycleState {
  const extended = extendCycle(state, today);
  return weeks === 3 ? extended : { ...extended, weeks: 2 };
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

/** Texte d'aide sous le réglage de durée (maquette Seances). */
export function durationHint(state: CycleState, today: IsoDate): string {
  const status = cycleStatus(state, today);
  const days = status.daysLeft === 1 ? '1 jour' : `${String(status.daysLeft)} jours`;
  if (status.weeks === 3 && status.week === 3) {
    return `Dernière semaine du cycle ${status.current} prolongé : ${status.next} commence dans ${days}. Revenir à 2 semaines fait basculer vers ${status.next} maintenant.`;
  }
  if (status.weeks === 3) {
    return `Semaine manquée : ${status.current} est prolongé d’une semaine. ${status.next} commence dans ${days}, puis l’alternance reprend à 2 semaines.`;
  }
  return `Mêmes muscles que ${status.next}, autres mouvements. Une semaine manquée ? Passe à 3 semaines, la bascule vers ${status.next} sera décalée.`;
}

/** Aide quand l'onglet affiché n'est pas le cycle en cours. */
export function upcomingHint(state: CycleState, today: IsoDate, cycle: CycleId): string {
  const status = cycleStatus(state, today);
  const days = status.daysLeft === 1 ? '1 jour' : `${String(status.daysLeft)} jours`;
  return `${cycle} commence dans ${days}, pour 2 semaines. Seul le cycle en cours peut être prolongé.`;
}
