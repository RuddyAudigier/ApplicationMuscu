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

export const loadLastReport = (): Report | null => {
  const v = read(LAST_REPORT_KEY);
  return isReport(v) ? v : null;
};
export const saveLastReport = (report: Report | null): boolean => write(LAST_REPORT_KEY, report);
