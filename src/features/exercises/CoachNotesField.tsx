import { useEffect, useRef, useState } from 'react';
import { useSaveCoachNotes } from '@/data/queries';
import type { Exercise, Id } from '@/domain/model';
import { Button, useToast } from '@/ui';
import styles from './ExerciseDetailScreen.module.css';

type Status = 'idle' | 'saving' | 'saved' | 'error';

/** CRLF / CR → LF, comme le repo (INV §3.16) : un texte inchangé n'est pas renvoyé. */
const normalize = (s: string): string => s.replace(/\r\n?/g, '\n');

/** File des sauvegardes par exercice (survit au démontage) : elles partent l'une après l'autre. */
const chains = new Map<Id, Promise<unknown>>();

function enqueue<T>(exerciseId: Id, run: () => Promise<T>): Promise<T> {
  const previous = chains.get(exerciseId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  chains.set(exerciseId, next);
  const cleanup = () => {
    if (chains.get(exerciseId) === next) chains.delete(exerciseId);
  };
  next.then(cleanup, cleanup);
  return next;
}

/** Remarques du coach : sauvegarde à la sortie du champ, état enregistré / erreur. */
export function CoachNotesField({ exercise }: { exercise: Exercise }) {
  const save = useSaveCoachNotes();
  const toast = useToast();
  const [text, setText] = useState(exercise.coachNotes);
  const [status, setStatus] = useState<Status>('idle');
  const saved = useRef(normalize(exercise.coachNotes));
  const latest = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = async () => {
    const notes = normalize(text);
    if (notes === saved.current) return;
    latest.current += 1;
    const request = latest.current;
    setStatus('saving');
    try {
      await enqueue(exercise.id, () => save.mutateAsync({ exerciseId: exercise.id, notes }));
      saved.current = notes;
      if (mounted.current && request === latest.current) setStatus('saved');
    } catch {
      if (!mounted.current) {
        toast.show(`Remarques du coach de « ${exercise.name} » non enregistrées. Vérifie ta connexion.`, 'error');
      } else if (request === latest.current) {
        setStatus('error');
      }
    }
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
          onBlur={() => {
            void persist();
          }}
        />
      </label>
      <p role="status" className={styles.notesStatus}>
        {status === 'saving' && 'Enregistrement…'}
        {status === 'saved' && 'Remarques enregistrées.'}
      </p>
      {status === 'error' && (
        <div role="alert" className={styles.inlineError}>
          <span>Remarques non enregistrées. Vérifie ta connexion : ton texte reste ici.</span>
          <Button
            variant="ghost"
            onClick={() => {
              void persist();
            }}
          >
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
