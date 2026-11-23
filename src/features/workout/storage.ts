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

const write = (key: string, value: unknown): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible (navigation privée) : la séance reste en mémoire.
  }
};

export const loadActiveWorkout = (): WorkoutState | null => parseWorkoutState(read(ACTIVE_WORKOUT_KEY));
export const saveActiveWorkout = (state: WorkoutState | null): void => { write(ACTIVE_WORKOUT_KEY, state); };

const isReport = (v: unknown): v is Report =>
  typeof v === 'object' && v !== null && Array.isArray((v as { exercises?: unknown }).exercises);

export const loadLastReport = (): Report | null => {
  const v = read(LAST_REPORT_KEY);
  return isReport(v) ? v : null;
};
export const saveLastReport = (report: Report | null): void => { write(LAST_REPORT_KEY, report); };
