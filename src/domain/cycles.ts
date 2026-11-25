import type { CycleId, CycleState, IsoDate } from './model';

const DAY_MS = 86_400_000;

/** Jours calendaires (UTC des composantes : insensible aux changements d'heure). */
const dayNumber = (iso: IsoDate): number => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

const fromDayNumber = (n: number): IsoDate => new Date(n * DAY_MS).toISOString().slice(0, 10);

const other = (c: CycleId): CycleId => (c === 'A' ? 'B' : 'A');

export const MIN_LENGTH_DAYS = 7;
export const MAX_LENGTH_DAYS = 28;
const STANDARD_DAYS = 14;

/** Jours d'une durée en semaines (demi-semaine arrondie au-dessus : 1,5 → 11, 2,5 → 18, 3,5 → 25). */
export const daysForWeeks = (weeks: number): number => Math.ceil(weeks * 7);

/** Nombre de semaines (entamées) d'un bloc de `days` jours. */
export const weeksForDays = (days: number): number => Math.ceil(days / 7);

/** « 2 semaines », « 1,5 semaine » : durée d'un bloc en jours, au demi-semaine près. */
export function lengthLabel(days: number): string {
  const w = Math.round(days / 3.5) / 2;
  return `${String(w).replace('.', ',')} semaine${w >= 2 ? 's' : ''}`;
}

interface Block { cycle: CycleId; start: number; days: number; extra: number }

/** Bloc qui contient `today` : le bloc stocké (durée + report), puis des blocs de la durée générale en alternant. */
function resolveBlock(state: CycleState, today: IsoDate): Block & { day: number } {
  const now = dayNumber(today);
  let block: Block = {
    cycle: state.current,
    start: dayNumber(state.startedOn),
    days: state.lengthDays + state.extraDays,
    extra: state.extraDays,
  };
  while (now - block.start >= block.days) {
    block = { cycle: other(block.cycle), start: block.start + block.days, days: state.lengthDays, extra: 0 };
  }
  return { ...block, day: now - block.start };
}

const toState = (b: Block, lengthDays: number): CycleState => ({
  current: b.cycle,
  startedOn: fromDayNumber(b.start),
  lengthDays,
  extraDays: b.extra,
});

/** Bloc réel contenant `today` (un état stocké périmé est résolu), au format `CycleState`. */
export function currentBlock(state: CycleState, today: IsoDate): CycleState {
  return toState(resolveBlock(state, today), state.lengthDays);
}

export function cycleStatus(
  state: CycleState,
  today: IsoDate,
): { current: CycleId; week: number; weeks: number; daysLeft: number; next: CycleId } {
  const b = resolveBlock(state, today);
  return {
    current: b.cycle,
    week: Math.max(1, Math.floor(b.day / 7) + 1),
    weeks: weeksForDays(b.days),
    daysLeft: b.days - b.day,
    next: other(b.cycle),
  };
}

/** Date de début du prochain bloc (lendemain du dernier jour du bloc en cours). */
export function nextBlockStart(state: CycleState, today: IsoDate): IsoDate {
  const b = resolveBlock(state, today);
  return fromDayNumber(b.start + b.days);
}

/** Jours de report du bloc en cours à `today`. */
export function postponedDays(state: CycleState, today: IsoDate): number {
  return resolveBlock(state, today).extra;
}

/**
 * Cycle actif le jour `day`, passé compris : avant `startedOn`, on remonte par blocs de la durée
 * générale en alternant (même hypothèse que la frise).
 */
export function cycleOn(state: CycleState, day: IsoDate): CycleId {
  const back = dayNumber(state.startedOn) - dayNumber(day);
  if (back <= 0) return resolveBlock(state, day).cycle;
  const blocks = Math.ceil(back / state.lengthDays);
  return blocks % 2 === 1 ? other(state.current) : state.current;
}

/** Reporte le prochain cycle d'une semaine : +7 jours sur le bloc en cours à `today` (sans limite). */
export function postponeCycle(state: CycleState, today: IsoDate): CycleState {
  const b = resolveBlock(state, today);
  return toState({ ...b, extra: b.extra + 7 }, state.lengthDays);
}

/** Un report peut être annulé s'il en reste un et que le bloc ne finirait pas avant aujourd'hui. */
export function canCancelPostpone(state: CycleState, today: IsoDate): boolean {
  const b = resolveBlock(state, today);
  return b.extra >= 7 && b.days - 7 > b.day;
}

/** Annule un report (−7 jours) si possible ; sinon renvoie le bloc en cours inchangé. */
export function cancelPostpone(state: CycleState, today: IsoDate): CycleState {
  const b = resolveBlock(state, today);
  if (!canCancelPostpone(state, today)) return toState(b, state.lengthDays);
  return toState({ ...b, extra: b.extra - 7 }, state.lengthDays);
}

/** Une durée est possible si le bloc en cours (durée + report) ne finirait pas avant aujourd'hui. */
export function canSetCycleLength(state: CycleState, today: IsoDate, lengthDays: number): boolean {
  const b = resolveBlock(state, today);
  return lengthDays + b.extra > b.day;
}

/** Change la durée générale ; le report (multiple de 7, issu des seuls reports) reste inchangé. */
export function setCycleLength(state: CycleState, today: IsoDate, lengthDays: number): CycleState {
  const b = resolveBlock(state, today);
  return toState(b, lengthDays);
}

/** Passe manuellement à l'autre cycle à partir d'aujourd'hui, pour la durée générale. */
export function switchCycle(state: CycleState, today: IsoDate): CycleState {
  const { current } = cycleStatus(state, today);
  return { current: other(current), startedOn: fromDayNumber(dayNumber(today)), lengthDays: state.lengthDays, extraDays: 0 };
}

interface TimelineBlock { cycle: CycleId; status: 'past' | 'current' | 'future'; progress: number }

/** Frise : 2 blocs passés, le bloc en cours (avancement 0..1) puis les blocs futurs, `blocks` au total. */
export function timeline(state: CycleState, today: IsoDate, blocks = 6): TimelineBlock[] {
  const b = resolveBlock(state, today);
  const pastCount = Math.min(2, Math.max(0, blocks - 1));
  const futureCount = Math.max(0, blocks - pastCount - 1);
  const out: TimelineBlock[] = [];
  for (let i = pastCount; i >= 1; i -= 1) {
    out.push({ cycle: i % 2 === 0 ? b.cycle : other(b.cycle), status: 'past', progress: 1 });
  }
  out.push({ cycle: b.cycle, status: 'current', progress: Math.max(0, b.day) / b.days });
  for (let i = 1; i <= futureCount; i += 1) {
    out.push({ cycle: i % 2 === 0 ? b.cycle : other(b.cycle), status: 'future', progress: 0 });
  }
  return out;
}

/** État par défaut quand aucun cycle n'est enregistré : cycle A, 2 semaines, démarré aujourd'hui. */
export const defaultCycleState = (today: IsoDate): CycleState => ({
  current: 'A',
  startedOn: today,
  lengthDays: STANDARD_DAYS,
  extraDays: 0,
});
