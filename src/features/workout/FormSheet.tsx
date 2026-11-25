import type { Form } from '@/domain/journal';
import { Button, Sheet } from '@/ui';
import styles from './FormSheet.module.css';

export interface FormSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (form: Form) => void;
}

/** Forme du jour demandée avant de démarrer une séance (fatigué : une série de moins par exercice). */
export function FormSheet({ open, onClose, onPick }: FormSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Ta forme du jour">
      <div className={styles.body}>
        <div className={styles.choices}>
          <Button
            variant="accent"
            size="lg"
            fullWidth
            onClick={() => {
              onPick('frais');
            }}
          >
            Frais
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => {
              onPick('fatigue');
            }}
          >
            Fatigué
          </Button>
        </div>
        <p className={styles.hint}>Fatigué : une série de moins par exercice.</p>
      </div>
    </Sheet>
  );
}
