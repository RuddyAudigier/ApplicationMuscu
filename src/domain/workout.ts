import { todayIso } from './dates';
import { FEELINGS, type Feeling, type Form } from './journal';
import type { CycleId, Exercise, Id, IsoDate, IsoDateTime, Performance, PerformanceInput, Session, Variant } from './model';
import { normalizeVariantName } from './names';
import { parseReps, parseRpe, parseWeight } from './numbers';
import { bestByReps, paretoMask } from './perfTable';
import { DEFAULT_VARIANT, getDefaultVariant } from './variants';

export interface SerieTarget { reps: number; weight: number | null }
export interface SerieEntry {
  variantKey: string; reps: string; kg: string; rpe: number; target: SerieTarget | null; validated: boolean;
  /** Horodatage de validation (ordre réel des séries pour le compte rendu), `null` si non validée. */
  validatedAt: IsoDateTime | null;
}
export interface WorkoutExercise {
  exerciseId: Id; name: string; plannedSeries: number; stoppedEarly: boolean; series: SerieEntry[];
  /** Ressenti de l'exercice (`null` = non renseigné). */
  feeling: Feeling | null;
}
export interface WorkoutState {
  version: 2; sessionId: Id; sessionName: string; cycle: CycleId | null; date: IsoDate; startedAt: IsoDateTime;
  exercises: WorkoutExercise[];
  /** Forme du jour choisie au démarrage (`null` = non renseignée). */
  form: Form | null;
  /** État général de la séance (texte libre). */
  mood: string;
}

export type WorkoutAction =
  | { type: 'setField'; ex: number; serie: number; field: 'variantKey' | 'reps' | 'kg'; value: string }
  | { type: 'setField'; ex: number; serie: number; field: 'rpe'; value: number }
  | { type: 'setTarget'; ex: number; serie: number; target: (SerieTarget & { variantKey: string }) | null }
  | { type: 'validate'; ex: number; serie: number; at: IsoDateTime }
  | { type: 'unlock'; ex: number; serie: number }
  | { type: 'addSerie'; ex: number }
  | { type: 'removeSerie'; ex: number; serie: number }
  | { type: 'stopExercise'; ex: number }
  | { type: 'addExercise'; exercise: Exercise; series?: number }
  | { type: 'removeExercise'; ex: number }
  | { type: 'setDate'; date: IsoDate }
  | { type: 'setForm'; form: Form | null }
  | { type: 'setMood'; mood: string }
  | { type: 'setFeeling'; ex: number; feeling: Feeling | null };

const DEFAULT_RPE = 9;
const DEFAULT_SERIES = 3;

/** Clé de variante d'une série : id si connu, sinon nom. */
const keyOf = (v: Variant): string => v.id ?? v.name;

const defaultKey = (exercise: Exercise | undefined): string =>
  exercise && exercise.variants.length > 0 ? keyOf(getDefaultVariant(exercise.variants)) : DEFAULT_VARIANT;

const emptySerie = (variantKey: string): SerieEntry => ({
  variantKey, reps: '', kg: '', rpe: DEFAULT_RPE, target: null, validated: false, validatedAt: null,
});

const buildExercise = (exerciseId: Id, name: string, series: number, exercise: Exercise | undefined): WorkoutExercise => ({
  exerciseId,
  name,
  plannedSeries: series,
  stoppedEarly: false,
  feeling: null,
  series: Array.from({ length: series }, () => emptySerie(defaultKey(exercise))),
});

/** Variante (id, nom) d'une clé de série ; clé inconnue → `variantId null`, nom brut. */
export function resolveVariant(exercise: Exercise | undefined, key: string): { variantId: Id | null; variantName: string } {
  const found = exercise?.variants.find(
    (v) => (v.id !== null && v.id === key) || normalizeVariantName(v.name) === normalizeVariantName(key),
  );
  return found ? { variantId: found.id, variantName: found.name } : { variantId: null, variantName: key };
}

/** Fatigué : une série de moins par exercice (jamais moins d'une). */
const seriesFor = (planned: number, form: Form | null): number => (form === 'fatigue' ? Math.max(1, planned - 1) : planned);

export function startWorkout(session: Session, exercises: Exercise[], now: Date, form: Form | null = null): WorkoutState {
  return {
    version: 2,
    sessionId: session.id,
    sessionName: session.name,
    cycle: session.cycle,
    date: todayIso(now),
    startedAt: now.toISOString(),
    form,
    mood: '',
    exercises: session.exercises.map((se) =>
      buildExercise(se.exerciseId, se.name, seriesFor(se.series, form), exercises.find((e) => e.id === se.exerciseId)),
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
        // La cible porte sa variante : la série passe sur cette variante (cible et variante cohérentes).
        return {
          ...s,
          target: { reps: target.reps, weight: target.weight },
          variantKey: target.variantKey,
          reps: String(target.reps),
          kg: target.weight === null ? s.kg : String(target.weight),
        };
      }));
    }
    case 'validate':
      return updateSerie(state, action.ex, action.serie, (s) =>
        s.validated || !canValidate(s) ? s : { ...s, validated: true, validatedAt: action.at });
    case 'unlock':
      return updateSerie(state, action.ex, action.serie, (s) => (s.validated ? { ...s, validated: false, validatedAt: null } : s));
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
    case 'setForm':
      return { ...state, form: action.form };
    case 'setMood':
      return { ...state, mood: action.mood };
    case 'setFeeling':
      return updateExercise(state, action.ex, (e) => (e.feeling === action.feeling ? e : { ...e, feeling: action.feeling }));
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

type Guard = (v: unknown) => boolean;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString: Guard = (v) => typeof v === 'string';
const isNumber: Guard = (v) => typeof v === 'number' && Number.isFinite(v);
const isBoolean: Guard = (v) => typeof v === 'boolean';
const orNull = (g: Guard): Guard => (v) => v === null || g(v);
const isCycle: Guard = (v) => v === 'A' || v === 'B';
const shape = (fields: Record<string, Guard>): Guard => (v) =>
  isRecord(v) && Object.entries(fields).every(([k, g]) => g(v[k]));
const arrayOf = (g: Guard): Guard => (v) => Array.isArray(v) && v.every((x) => g(x));

const isSerie = shape({
  variantKey: isString, reps: isString, kg: isString, rpe: isNumber, validated: isBoolean,
  validatedAt: orNull(isString), target: orNull(shape({ reps: isNumber, weight: orNull(isNumber) })),
});
const isFeeling: Guard = (v) => FEELINGS.some((f) => f.id === v);
const isForm: Guard = (v) => v === 'frais' || v === 'fatigue';
const isWorkoutState = shape({
  version: (v) => v === 2, sessionId: isString, sessionName: isString, cycle: orNull(isCycle), date: isString,
  startedAt: isString,
  exercises: arrayOf(shape({
    exerciseId: isString, name: isString, plannedSeries: isNumber, stoppedEarly: isBoolean, series: arrayOf(isSerie),
  })),
});

/** Relit une séance en cours sauvegardée (localStorage) : `null` si autre version ou invalide. */
export function parseWorkoutState(raw: unknown): WorkoutState | null {
  if (!isWorkoutState(raw)) return null;
  const r = raw as Omit<WorkoutState, 'form' | 'mood' | 'exercises'> & {
    form?: unknown; mood?: unknown; exercises: (Omit<WorkoutExercise, 'feeling'> & { feeling?: unknown })[];
  };
  // Séances sauvegardées avant l'état du jour : champs absents → valeurs par défaut.
  return {
    ...r,
    form: isForm(r.form) ? (r.form as Form) : null,
    mood: isString(r.mood) ? (r.mood as string) : '',
    exercises: r.exercises.map((e) => ({ ...e, feeling: isFeeling(e.feeling) ? (e.feeling as Feeling) : null })),
  };
}
