import { useId, useState, type ChangeEvent } from 'react';
import { importPerformances } from '@/domain/csv';
import type { Exercise } from '@/domain/model';
import { useAddPerformances } from '@/data/queries';
import { Sheet } from '@/ui';
import { cx } from './format';
import styles from './Records.module.css';

interface Outcome {
  /** Message de synthèse honnête (D8). */
  summary: string;
  kind: 'success' | 'info' | 'error';
  errors: string[];
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Lecture du fichier impossible.'));
    };
    reader.readAsText(file);
  });
}

const lines = (n: number): string => `${String(n)} ligne${n > 1 ? 's' : ''}`;

/** Menu « ⋯ » : import CSV des performances, avec retour ligne par ligne. */
interface CsvImportSheetProps {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  /** État du chargement des exercices : l'import exige le catalogue complet. */
  exercisesStatus: 'pending' | 'error' | 'success';
}

export function CsvImportSheet({ open, onClose, exercises, exercisesStatus }: CsvImportSheetProps) {
  const inputId = useId();
  const addPerformances = useAddPerformances();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const ready = exercisesStatus === 'success';

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !ready) return;
    setBusy(true);
    setOutcome(null);
    try {
      const text = await readText(file);
      const { rows, errors } = importPerformances(text, exercises);
      if (rows.length === 0) {
        setOutcome({ summary: 'Aucune ligne importée.', kind: 'error', errors });
        return;
      }
      const result = await addPerformances.mutateAsync(rows);
      setOutcome(
        result.queued
          ? {
              summary: `Hors ligne : ${lines(rows.length)} en attente, envoyée${rows.length > 1 ? 's' : ''} au retour du réseau.`,
              kind: 'info',
              errors,
            }
          : { summary: `${lines(result.written)} importée${result.written > 1 ? 's' : ''}.`, kind: 'success', errors },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setOutcome({ summary: `Import échoué, rien n'a été enregistré : ${message}`, kind: 'error', errors: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setOutcome(null);
        onClose();
      }}
      title="Options"
    >
      <div className={styles.menu}>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className={cx(styles.srOnly, styles.fileInput)}
          disabled={busy || !ready}
          onChange={(e) => {
            void onFile(e);
          }}
        />
        <label
          htmlFor={inputId}
          className={cx(styles.menuItem, !ready && styles.menuItemDisabled)}
          aria-busy={busy || undefined}
        >
          {busy ? 'Import en cours…' : 'Importer un CSV'}
          <span className={styles.menuHint}>Colonnes : exercice, reps, poids, rpe, variante, date</span>
        </label>
        {exercisesStatus === 'pending' && <p className={styles.importSummary}>Chargement des exercices…</p>}
        {exercisesStatus === 'error' && (
          <p role="alert" className={styles.importError}>
            Impossible de charger les exercices : import indisponible pour le moment.
          </p>
        )}
        {outcome && (
          <div role={outcome.kind === 'error' ? 'alert' : 'status'} className={styles.importResult}>
            <p className={outcome.kind === 'error' ? styles.importError : styles.importSummary}>{outcome.summary}</p>
            {outcome.errors.length > 0 && (
              <>
                <p className={styles.importSummary}>{lines(outcome.errors.length)} ignorée{outcome.errors.length > 1 ? 's' : ''} :</p>
                <ul className={styles.importErrors}>
                  {outcome.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
