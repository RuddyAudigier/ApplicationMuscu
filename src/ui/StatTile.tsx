import styles from './StatTile.module.css';
import { cx } from './cx';

export interface StatTileProps {
  label: string;
  value: string | number;
  /** Unité affichée après la valeur (kg, reps…). */
  unit?: string;
  tone?: 'default' | 'accent';
  className?: string;
}

/** Chiffre clé (grand nombre Space Grotesk) + libellé. */
export function StatTile({ label, value, unit, tone = 'default', className }: StatTileProps) {
  return (
    <div className={cx(styles.tile, tone === 'accent' && styles.accent, className)}>
      <span className={styles.value}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
