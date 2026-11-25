import styles from './ProgressBar.module.css';
import { cx } from './cx';

export interface ProgressBarProps {
  /** Nom accessible. */
  label: string;
  value: number;
  max?: number;
  tone?: 'primary' | 'success' | 'warning';
  className?: string;
}

export function ProgressBar({
  label,
  value,
  max = 100,
  tone = 'primary',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      className={cx(styles.track, className)}
    >
      <div className={cx(styles.fill, styles[tone])} style={{ width: `${String(percent)}%` }} />
    </div>
  );
}
