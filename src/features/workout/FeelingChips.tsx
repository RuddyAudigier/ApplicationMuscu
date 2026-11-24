import { FEELINGS, type Feeling } from '@/domain/journal';
import { Chip } from '@/ui';
import styles from './FeelingChips.module.css';

export interface FeelingChipsProps {
  /** Nom accessible du groupe (ex. « Ressenti — Squat »). */
  label: string;
  value: Feeling | null;
  onChange: (value: Feeling | null) => void;
}

/** Ressenti d'un exercice : une seule puce active, re-toucher l'active l'efface. */
export function FeelingChips({ label, value, onChange }: FeelingChipsProps) {
  return (
    <div role="group" aria-label={label} className={styles.chips}>
      {FEELINGS.map((f) => (
        <Chip
          key={f.id}
          selected={value === f.id}
          onClick={() => {
            onChange(value === f.id ? null : f.id);
          }}
        >
          {f.label}
        </Chip>
      ))}
    </div>
  );
}
