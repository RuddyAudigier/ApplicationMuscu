import { useState } from 'react';
import type { Exercise, Id } from '@/domain/model';
import { Icon, Sheet } from '@/ui';
import { cx } from './format';
import styles from './Records.module.css';

interface ExercisePickerProps {
  exercises: Exercise[];
  selected: Exercise | null;
  onSelect: (id: Id) => void;
  /** `pill` : pilule claire (Records) ; `card` : carte « Exercice » (ajout de PR). */
  look: 'pill' | 'card';
}

/** Bouton d'exercice + panneau de choix (liste en radios). */
export function ExercisePicker({ exercises, selected, onSelect, look }: ExercisePickerProps) {
  const [open, setOpen] = useState(false);
  const name = selected?.name ?? 'Choisir un exercice';
  return (
    <>
      <button
        type="button"
        className={look === 'pill' ? styles.exercisePill : styles.exerciseCard}
        aria-haspopup="dialog"
        aria-label={`Exercice : ${name}. Changer d'exercice`}
        onClick={() => {
          setOpen(true);
        }}
      >
        {look === 'card' ? (
          <span className={styles.exerciseCardText}>
            <span className={styles.exerciseCardLabel}>Exercice</span>{' '}
            <span className={styles.exerciseCardName}>{name}</span>
          </span>
        ) : (
          <span>{name}</span>
        )}
        <span className={styles.chevronDown}>
          <Icon name="chevron" size={16} />
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Choisir un exercice"
      >
        <div role="radiogroup" aria-label="Exercices" className={styles.exerciseList}>
          {exercises.map((e) => {
            const checked = e.id === selected?.id;
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={checked}
                className={cx(styles.exerciseOption, checked && styles.exerciseOptionChecked)}
                onClick={() => {
                  setOpen(false);
                  onSelect(e.id);
                }}
              >
                <span>{e.name}</span>
                {checked && <Icon name="check" size={18} />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
