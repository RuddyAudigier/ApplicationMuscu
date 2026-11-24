import { Button } from '@/ui';
import styles from './ExerciseDetailScreen.module.css';

/** Séances non chargées : les cycles A/B ne peuvent pas être affichés. */
export function SessionsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className={styles.inlineError}>
      <span>Cycles indisponibles : impossible de charger les séances.</span>
      <Button variant="ghost" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}
