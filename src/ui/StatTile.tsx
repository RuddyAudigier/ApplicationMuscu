import styles from './StatTile.module.css';
import { cx } from './cx';

export interface StatTileProps {
  label: string;
  value: string | number;
  /** Unité affichée après la valeur (kg, reps…). */
  unit?: string;
  tone?: 'default' | 'accent';
  /** `sm` : valeur plus petite, pour les grilles à deux colonnes. */
  size?: 'md' | 'sm';
  className?: string;
}

/** Chiffre clé (grand nombre Space Grotesk) + libellé. */
export function StatTile({ label, value, unit, tone = 'default', size = 'md', className }: StatTileProps) {
  return (
    <div className={cx(styles.tile, tone === 'accent' && styles.accent, size === 'sm' && styles.sm, className)}>
      <span className={styles.value}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
