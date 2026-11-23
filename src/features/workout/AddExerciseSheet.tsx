import { useState } from 'react';
import type { Exercise } from '@/domain/model';
import { normalizeSearch } from '@/domain/names';
import { Field, Sheet } from '@/ui';
import styles from './WorkoutScreen.module.css';

export interface AddExerciseSheetProps {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onPick: (exercise: Exercise) => void;
}

/** Ajout d'un exercice bonus à la séance en cours. */
export function AddExerciseSheet({ open, onClose, exercises, onPick }: AddExerciseSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Exercice bonus">
      <AddExerciseBody exercises={exercises} onPick={onPick} />
    </Sheet>
  );
}

function AddExerciseBody({ exercises, onPick }: Pick<AddExerciseSheetProps, 'exercises' | 'onPick'>) {
  const [query, setQuery] = useState('');
  const q = normalizeSearch(query);
  const list = exercises
    .filter((e) => q === '' || normalizeSearch(e.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <div className={styles.bonus}>
      <Field
        label="Rechercher un exercice"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
      />
      {list.length === 0 ? (
        <p className={styles.muted}>Aucun exercice trouvé.</p>
      ) : (
        <ul className={styles.bonusList}>
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={styles.bonusItem}
                onClick={() => {
                  onPick(e);
                }}
              >
                <span>{e.name}</span>
                {e.muscleGroups.length > 0 && <span className={styles.muted}>{e.muscleGroups.join(', ')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
