import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { workoutReducer, type WorkoutAction, type WorkoutState } from '@/domain/workout';
import { useToast } from '@/ui';
import { saveActiveWorkout } from './storage';

export const SAVE_FAILED_MESSAGE =
  'Impossible de sauvegarder la séance sur cet appareil… Ne ferme pas l’app avant « Terminer ».';

interface WorkoutApi {
  state: WorkoutState;
  dispatch: Dispatch<WorkoutAction>;
  /** Coupe la sauvegarde automatique (séance terminée : la clé vient d'être effacée). */
  stopPersisting: () => void;
}

const WorkoutContext = createContext<WorkoutApi | null>(null);

/** Séance en cours : reducer du domaine, sauvegardée en `localStorage` à chaque changement. */
export function WorkoutProvider({ initial, children }: { initial: WorkoutState; children: ReactNode }) {
  const [state, dispatch] = useReducer(workoutReducer, initial);
  const persisting = useRef(true);
  const warned = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (!persisting.current || saveActiveWorkout(state) || warned.current) return;
    // Prévenu une seule fois : la séance reste en mémoire tant que l'écran est ouvert.
    warned.current = true;
    toast.show(SAVE_FAILED_MESSAGE, 'error');
  }, [state, toast]);

  const stopPersisting = useCallback(() => {
    persisting.current = false;
  }, []);

  const api = useMemo(() => ({ state, dispatch, stopPersisting }), [state, stopPersisting]);
  return <WorkoutContext value={api}>{children}</WorkoutContext>;
}

export function useWorkout(): WorkoutApi {
  const api = useContext(WorkoutContext);
  if (!api) throw new Error('useWorkout doit être utilisé dans un WorkoutProvider');
  return api;
}
