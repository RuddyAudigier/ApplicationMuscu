import { useRef, useState } from 'react';
import { useSaveCoachNotes } from '@/data/queries';
import type { Exercise } from '@/domain/model';
import styles from './ExerciseDetailScreen.module.css';

type Status = 'idle' | 'saving' | 'saved' | 'error';

/** CRLF / CR → LF, comme le repo (INV §3.16) : un texte inchangé n'est pas renvoyé. */
const normalize = (s: string): string => s.replace(/\r\n?/g, '\n');

/** Remarques du coach : sauvegarde à la sortie du champ, état enregistré / erreur. */
export function CoachNotesField({ exercise }: { exercise: Exercise }) {
  const save = useSaveCoachNotes();
  const [text, setText] = useState(exercise.coachNotes);
  const [status, setStatus] = useState<Status>('idle');
  const saved = useRef(normalize(exercise.coachNotes));

  const onBlur = () => {
    const notes = normalize(text);
    if (notes === saved.current) return;
    setStatus('saving');
    save.mutate(
      { exerciseId: exercise.id, notes },
      {
        onSuccess: () => {
          saved.current = notes;
          setStatus('saved');
        },
        onError: () => {
          setStatus('error');
        },
      },
    );
  };

  return (
    <div className={styles.notesBlock}>
      <label className={styles.notes}>
        <span className={styles.notesLabel}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Remarques du coach · affichées en séance
        </span>
        <textarea
          rows={2}
          value={text}
          placeholder="Consignes d’exécution, tempo, points de vigilance…"
          className={styles.notesInput}
          onChange={(e) => {
            setText(e.target.value);
            if (status !== 'saving') setStatus('idle');
          }}
          onBlur={onBlur}
        />
      </label>
      <p role="status" className={styles.notesStatus}>
        {status === 'saving' && 'Enregistrement…'}
        {status === 'saved' && 'Remarques enregistrées.'}
      </p>
      {status === 'error' && (
        <p role="alert" className={styles.notesError}>
          Remarques non enregistrées. Vérifie ta connexion : ton texte reste ici, quitte le champ pour réessayer.
        </p>
      )}
    </div>
  );
}
