import { FEELINGS, type Feeling } from '@/domain/journal';
import { Chip } from '@/ui';
import styles from './FeelingChips.module.css';

export interface FeelingChipsProps {
  /** Nom accessible du groupe (ex. « Ressenti — Squat »). */
  label: string;
  value: Feeling | null;
  onChange: (value: Feeling | null) => void;
  /** Libellé visible au-dessus des puces (ex. « Mon état »). */
  caption?: string;
  /** Séparée de la rangée au-dessus par un filet et plus d'espace. */
  spaced?: boolean;
}

/** Ressenti d'un exercice : une seule puce active, re-toucher l'active l'efface. */
export function FeelingChips({ label, value, onChange, caption, spaced = false }: FeelingChipsProps) {
  return (
    <div className={spaced ? styles.spaced : undefined}>
      {caption && <p className={styles.caption}>{caption}</p>}
      <div role="group" aria-label={label} className={styles.chips}>
        {FEELINGS.map((f) => (
          <Chip
            key={f.id}
            selected={value === f.id}
            className={spaced ? styles.state : undefined}
            onClick={() => {
              onChange(value === f.id ? null : f.id);
            }}
          >
            {f.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
