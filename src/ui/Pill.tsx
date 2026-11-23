import type { ReactNode } from 'react';
import styles from './Pill.module.css';
import { cx } from './cx';

export interface PillProps {
  selected?: boolean;
  onSelect: () => void;
  /** Couleur à l'état sélectionné : clair (#f5f5f4) ou citron. */
  tone?: 'light' | 'accent';
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Pastille sélectionnable (variante, RPE…) : role="radio" + aria-checked.
 * À placer dans un conteneur role="radiogroup" aria-label="…".
 */
export function Pill({
  selected = false,
  onSelect,
  tone = 'light',
  disabled,
  className,
  children,
}: PillProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cx(styles.pill, selected && styles.selected, selected && styles[tone], className)}
    >
      {children}
    </button>
  );
}
