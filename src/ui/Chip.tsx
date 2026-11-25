import type { ReactNode } from 'react';
import styles from './Chip.module.css';
import { cx } from './cx';

export interface ChipProps {
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** Bouton bascule compact (filtres, sélection multiple). */
export function Chip({ selected = false, onClick, disabled, className, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(styles.chip, selected && styles.selected, className)}
    >
      {children}
    </button>
  );
}
