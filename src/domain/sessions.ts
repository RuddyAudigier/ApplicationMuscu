import { cycleOn } from './cycles';
import type { CycleId, CycleState, IsoDate, Performance, Session } from './model';
import { normalizeSearch } from './names';

/** Ordre du Programme : date de création, puis id (comparaison binaire, stable entre plateformes). */
const byCreation = (a: Session, b: Session): number =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Séances d'un cycle (ou non assignées si `null`), de la plus ancienne à la plus récente (A1, A2…). */
export function sessionsOfCycle(sessions: Session[], cycle: CycleId | null): Session[] {
  return sessions.filter((s) => s.cycle === cycle).sort(byCreation);
}

/**
 * Libellé de cycle d'une séance → « Cycle A ».
 * (Le rang A1, A2… n'est plus affiché.)
 */
export function sessionCode(cycle: CycleId): string {
  return `Cycle ${cycle}`;
}

/** Nom de séance des perfs saisies à la main sans séance ce jour-là. */
export const MANUAL_SESSION = 'Ajout manuel';
/** Noms qui ne désignent pas une vraie séance (saisies manuelles, imports). */
const NOT_A_SESSION = new Set([MANUAL_SESSION, 'Hors séance', 'Import CSV', '']);

function mostFrequent(names: string[]): string | null {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [name, n] of counts) {
    if (n > max) {
      best = name;
      max = n;
    }
  }
  return best;
}

/**
 * Nom de séance à donner à une perf ajoutée à la main le jour `day` :
 * 1. la séance prévue du cycle actif ce jour-là, si elle a été faite ce jour-là ;
 * 2. sinon le nom de séance le plus fréquent ce jour-là (hors saisies manuelles et imports) ;
 * 3. sinon « Ajout manuel ».
 */
export function sessionNameForDay(
  perfs: Pick<Performance, 'performanceDate' | 'sessionName'>[],
  day: IsoDate,
  plan?: { sessions: Session[]; cycleState: CycleState },
): string {
  const names = perfs
    .filter((p) => p.performanceDate.slice(0, 10) === day)
    .map((p) => p.sessionName.trim())
    .filter((name) => !NOT_A_SESSION.has(name));
  if (plan) {
    const planned = new Map(
      sessionsOfCycle(plan.sessions, cycleOn(plan.cycleState, day)).map((s) => [normalizeSearch(s.name), s.name]),
    );
    const performed = names.flatMap((name) => {
      const match = planned.get(normalizeSearch(name));
      return match === undefined ? [] : [match];
    });
    const best = mostFrequent(performed);
    if (best !== null) return best;
  }
  return mostFrequent(names) ?? MANUAL_SESSION;
}
