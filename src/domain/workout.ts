import { todayIso } from './dates';
import type { CycleId, Exercise, Id, IsoDate, IsoDateTime, Performance, PerformanceInput, Session, Variant } from './model';
import { normalizeVariantName } from './names';
import { parseReps, parseRpe, parseWeight } from './numbers';
import { bestByReps, paretoMask } from './perfTable';
import { DEFAULT_VARIANT, getDefaultVariant } from './variants';

export interface SerieTarget { reps: number; weight: number | null }
export interface SerieEntry {
  variantKey: string; reps: string; kg: string; rpe: number; target: SerieTarget | null; validated: boolean;
}
export interface WorkoutExercise {
  exerciseId: Id; name: string; plannedSeries: number; stoppedEarly: boolean; series: SerieEntry[];
}
export interface WorkoutState {
  version: 2; sessionId: Id; sessionName: string; cycle: CycleId | null; date: IsoDate; startedAt: IsoDateTime;
  exercises: WorkoutExercise[];
}

export type WorkoutAction =
  | { type: 'setField'; ex: number; serie: number; field: 'variantKey' | 'reps' | 'kg'; value: string }
  | { type: 'setField'; ex: number; serie: number; field: 'rpe'; value: number }
  | { type: 'setTarget'; ex: number; serie: number; target: SerieTarget | null }
  | { type: 'validate'; ex: number; serie: number }
  | { type: 'unlock'; ex: number; serie: number }
  | { type: 'addSerie'; ex: number }
  | { type: 'removeSerie'; ex: number; serie: number }
  | { type: 'stopExercise'; ex: number }
  | { type: 'addExercise'; exercise: Exercise; series?: number }
  | { type: 'removeExercise'; ex: number }
  | { type: 'setDate'; date: IsoDate };

const DEFAULT_RPE = 9;
const DEFAULT_SERIES = 3;

/** Clé de variante d'une série : id si connu, sinon nom. */
const keyOf = (v: Variant): string => v.id ?? v.name;

const defaultKey = (exercise: Exercise | undefined): string =>
  exercise && exercise.variants.length > 0 ? keyOf(getDefaultVariant(exercise.variants)) : DEFAULT_VARIANT;

const emptySerie = (variantKey: string): SerieEntry => ({
  variantKey, reps: '', kg: '', rpe: DEFAULT_RPE, target: null, validated: false,
});

const buildExercise = (exerciseId: Id, name: string, series: number, exercise: Exercise | undefined): WorkoutExercise => ({
  exerciseId,
  name,
  plannedSeries: series,
  stoppedEarly: false,
  series: Array.from({ length: series }, () => emptySerie(defaultKey(exercise))),
});

/** Variante (id, nom) d'une clé de série ; clé inconnue → `variantId null`, nom brut. */
export function resolveVariant(exercise: Exercise | undefined, key: string): { variantId: Id | null; variantName: string } {
  const found = exercise?.variants.find(
    (v) => (v.id !== null && v.id === key) || normalizeVariantName(v.name) === normalizeVariantName(key),
  );
  return found ? { variantId: found.id, variantName: found.name } : { variantId: null, variantName: key };
}

export function startWorkout(session: Session, exercises: Exercise[], now: Date): WorkoutState {
  return {
    version: 2,
    sessionId: session.id,
    sessionName: session.name,
    cycle: session.cycle,
    date: todayIso(now),
    startedAt: now.toISOString(),
    exercises: session.exercises.map((se) =>
      buildExercise(se.exerciseId, se.name, se.series, exercises.find((e) => e.id === se.exerciseId)),
    ),
  };
}

/** Reps entier ≥ 1, poids ≥ 0 (`parseWeight`), RPE entier 6–10. */
export function canValidate(s: SerieEntry): boolean {
  const reps = parseReps(s.reps);
  return reps !== null && reps >= 1 && parseWeight(s.kg) !== null && parseRpe(s.rpe) !== null;
}

function updateExercise(
  state: WorkoutState,
  ex: number,
  fn: (e: WorkoutExercise) => WorkoutExercise,
): WorkoutState {
  const current = state.exercises[ex];
  if (!current) return state;
  const next = fn(current);
  if (next === current) return state;
  return { ...state, exercises: state.exercises.map((e, i) => (i === ex ? next : e)) };
}

function updateSerie(
  state: WorkoutState,
  ex: number,
  serie: number,
  fn: (s: SerieEntry) => SerieEntry,
): WorkoutState {
  return updateExercise(state, ex, (e) => {
    const current = e.series[serie];
    if (!current) return e;
    const next = fn(current);
    if (next === current) return e;
    return { ...e, series: e.series.map((s, i) => (i === serie ? next : s)) };
  });
}

/** Une série validée est verrouillée : `unlock` d'abord. */
const editable = (fn: (s: SerieEntry) => SerieEntry) => (s: SerieEntry): SerieEntry => (s.validated ? s : fn(s));

function trimTrailingPending(series: SerieEntry[]): SerieEntry[] {
  let end = series.length;
  while (end > 0 && series[end - 1]?.validated === false) end -= 1;
  return series.slice(0, end);
}

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'setField':
      return updateSerie(state, action.ex, action.serie, editable((s) =>
        action.field === 'rpe' ? { ...s, rpe: action.value } : { ...s, [action.field]: action.value },
      ));
    case 'setTarget': {
      const { target } = action;
      return updateSerie(state, action.ex, action.serie, editable((s) => {
        if (target === null) return { ...s, target: null };
        return { ...s, target, reps: String(target.reps), kg: target.weight === null ? s.kg : String(target.weight) };
      }));
    }
    case 'validate':
      return updateSerie(state, action.ex, action.serie, (s) => (s.validated || !canValidate(s) ? s : { ...s, validated: true }));
    case 'unlock':
      return updateSerie(state, action.ex, action.serie, (s) => (s.validated ? { ...s, validated: false } : s));
    case 'addSerie':
      return updateExercise(state, action.ex, (e) => {
        const last = e.series[e.series.length - 1];
        const key = last?.variantKey ?? DEFAULT_VARIANT;
        return { ...e, stoppedEarly: false, series: [...e.series, emptySerie(key)] };
      });
    case 'removeSerie':
      return updateExercise(state, action.ex, (e) => {
        const s = e.series[action.serie];
        if (!s || s.validated) return e;
        return { ...e, series: e.series.filter((_, i) => i !== action.serie) };
      });
    case 'stopExercise':
      return updateExercise(state, action.ex, (e) => ({ ...e, stoppedEarly: true, series: trimTrailingPending(e.series) }));
    case 'addExercise': {
      const { exercise } = action;
      const added = buildExercise(exercise.id, exercise.name, action.series ?? DEFAULT_SERIES, exercise);
      return { ...state, exercises: [...state.exercises, added] };
    }
    case 'removeExercise':
      if (!state.exercises[action.ex]) return state;
      return { ...state, exercises: state.exercises.filter((_, i) => i !== action.ex) };
    case 'setDate':
      return { ...state, date: action.date };
  }
}

/** Performances à enregistrer : séries validées (et valides) uniquement, dans l'ordre de la séance. */
export function toPerformanceInputs(state: WorkoutState, exercises: Exercise[]): PerformanceInput[] {
  const out: PerformanceInput[] = [];
  for (const we of state.exercises) {
    const exercise = exercises.find((e) => e.id === we.exerciseId);
    we.series.forEach((s, i) => {
      if (!s.validated || !canValidate(s)) return;
      out.push({
        exerciseId: we.exerciseId,
        exerciseName: exercise?.name ?? we.name,
        sessionName: state.sessionName,
        reps: parseReps(s.reps) ?? 0,
        weight: parseWeight(s.kg),
        rpe: parseRpe(s.rpe),
        ...resolveVariant(exercise, s.variantKey),
        serieNumber: i + 1,
        performanceDate: state.date,
      });
    });
  }
  return out;
}

export interface RecordRow { reps: number; weight: number | null; rpe: number | null; date: IsoDate | null }

/** Tableau « Mes records » : 30 lignes (1–30 reps), cellules dominées (Pareto) vides. */
export function recordsTable(perfs: Performance[], exerciseId: Id, variant: Variant): RecordRow[] {
  const cells = paretoMask(bestByReps(perfs.filter((p) => p.exerciseId === exerciseId), variant));
  return cells.map((p, i) => ({
    reps: i + 1,
    weight: p?.weight ?? null,
    rpe: p?.rpe ?? null,
    date: p?.performanceDate ?? null,
  }));
}
