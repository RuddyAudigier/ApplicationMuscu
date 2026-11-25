import styles from './ProgressRing.module.css';
import { cx } from './cx';

export interface ProgressRingProps {
  /** Nom accessible, ex. « Séries faites : 9 sur 14 ». */
  label: string;
  value: number;
  max: number;
  className?: string;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Anneau de progression citron avec « valeur/max » au centre. */
export function ProgressRing({ label, value, max, className }: ProgressRingProps) {
  const clamped = Math.min(Math.max(value, 0), Math.max(max, 0));
  const ratio = max > 0 ? clamped / max : 0;
  return (
    <span role="img" aria-label={label} className={cx(styles.ring, className)}>
      <svg viewBox="0 0 44 44" className={styles.svg} aria-hidden="true">
        <circle cx="22" cy="22" r={RADIUS} className={styles.track} />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          className={styles.bar}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      <span className={styles.label} aria-hidden="true">{`${String(clamped)}/${String(max)}`}</span>
    </span>
  );
}
