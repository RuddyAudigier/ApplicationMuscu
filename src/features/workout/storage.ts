import { FEELINGS } from '@/domain/journal';
import type { Report } from '@/domain/report';
import { parseWorkoutState, type WorkoutState } from '@/domain/workout';

/** Séance en cours, persistée pour survivre à une fermeture de l'app. */
export const ACTIVE_WORKOUT_KEY = 'workout_state_v2';
/** Dernier compte rendu, visible depuis l'accueil jusqu'à la séance suivante. */
export const LAST_REPORT_KEY = 'mymuscle_last_report_v1';

const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};

/** `false` si le stockage est indisponible (navigation privée, quota) : l'appelant prévient. */
const write = (key: string, value: unknown): boolean => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[workout] Écriture de ${key} impossible :`, e);
    return false;
  }
};

export const loadActiveWorkout = (): WorkoutState | null => parseWorkoutState(read(ACTIVE_WORKOUT_KEY));
/** `true` si la séance est bien écrite sur l'appareil. */
export const saveActiveWorkout = (state: WorkoutState | null): boolean => write(ACTIVE_WORKOUT_KEY, state);

const isReport = (v: unknown): v is Report =>
  typeof v === 'object' && v !== null && Array.isArray((v as { exercises?: unknown }).exercises);

const FORMS: readonly unknown[] = ['frais', 'fatigue'];
const FEELING_IDS: readonly unknown[] = FEELINGS.map((f) => f.id);

/** Comptes rendus enregistrés avant l'état du jour : champs absents → valeurs par défaut. */
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isWarmupDone = (v: unknown): v is Report['warmup'][number] =>
  isRec(v) && typeof v.name === 'string' && typeof v.detail === 'string';
const isWarmupSetDone = (v: unknown): v is Report['exercises'][number]['warmupSets'][number] =>
  isRec(v) && typeof v.reps === 'number' && (v.weight === null || typeof v.weight === 'number');

const normalizeReport = (r: Report): Report => {
  const loose = r as unknown as { logId?: unknown; form?: unknown; mood?: unknown; warmup?: unknown };
  return {
    ...r,
    logId: typeof loose.logId === 'string' ? loose.logId : null,
    form: FORMS.includes(loose.form) ? (loose.form as Report['form']) : null,
    mood: typeof loose.mood === 'string' ? loose.mood : '',
    warmup: Array.isArray(loose.warmup) ? (loose.warmup as unknown[]).filter(isWarmupDone) : [],
    exercises: r.exercises.map((e) => {
      const ex = e as unknown as { exerciseId?: unknown; feeling?: unknown; warmupSets?: unknown };
      return {
        ...e,
        exerciseId: typeof ex.exerciseId === 'string' ? ex.exerciseId : '',
        feeling: FEELING_IDS.includes(ex.feeling) ? (ex.feeling as Report['exercises'][number]['feeling']) : null,
        warmupSets: Array.isArray(ex.warmupSets) ? (ex.warmupSets as unknown[]).filter(isWarmupSetDone) : [],
      };
    }),
  };
};

export const loadLastReport = (): Report | null => {
  const v = read(LAST_REPORT_KEY);
  return isReport(v) ? normalizeReport(v) : null;
};
export const saveLastReport = (report: Report | null): boolean => write(LAST_REPORT_KEY, report);
