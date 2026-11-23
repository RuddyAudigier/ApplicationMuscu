import type { CycleId, CycleState, IsoDate } from './model';

const DAY_MS = 86_400_000;
const STANDARD_WEEKS = 2;

/** Jours calendaires (UTC des composantes : insensible aux changements d'heure). */
const dayNumber = (iso: IsoDate): number => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

const fromDayNumber = (n: number): IsoDate => new Date(n * DAY_MS).toISOString().slice(0, 10);

const other = (c: CycleId): CycleId => (c === 'A' ? 'B' : 'A');

interface Block { cycle: CycleId; start: number; weeks: number }

/** Bloc qui contient `today` : avance de blocs de 2 semaines en alternant si la période est dépassée. */
function resolveBlock(state: CycleState, today: IsoDate): Block & { day: number } {
  const now = dayNumber(today);
  let block: Block = { cycle: state.current, start: dayNumber(state.startedOn), weeks: state.weeks };
  while (now - block.start >= block.weeks * 7) {
    block = { cycle: other(block.cycle), start: block.start + block.weeks * 7, weeks: STANDARD_WEEKS };
  }
  return { ...block, day: now - block.start };
}

export function cycleStatus(
  state: CycleState,
  today: IsoDate,
): { current: CycleId; week: number; weeks: number; daysLeft: number; next: CycleId } {
  const b = resolveBlock(state, today);
  return {
    current: b.cycle,
    week: Math.max(1, Math.floor(b.day / 7) + 1),
    weeks: b.weeks,
    daysLeft: b.weeks * 7 - b.day,
    next: other(b.cycle),
  };
}

/** Prolonge le cycle en cours à 3 semaines (semaine manquée). */
export function extendCycle(state: CycleState): CycleState {
  return { ...state, weeks: 3 };
}

/** Passe manuellement à l'autre cycle à partir d'aujourd'hui, pour 2 semaines. */
export function switchCycle(state: CycleState, today: IsoDate): CycleState {
  const { current } = cycleStatus(state, today);
  return { current: other(current), startedOn: fromDayNumber(dayNumber(today)), weeks: STANDARD_WEEKS };
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
  out.push({ cycle: b.cycle, status: 'current', progress: Math.max(0, b.day) / (b.weeks * 7) });
  for (let i = 1; i <= futureCount; i += 1) {
    out.push({ cycle: i % 2 === 0 ? b.cycle : other(b.cycle), status: 'future', progress: 0 });
  }
  return out;
}
