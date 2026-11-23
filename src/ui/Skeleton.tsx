import styles from './Skeleton.module.css';
import { cx } from './cx';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Forme ronde (avatar, pastille). */
  circle?: boolean;
  className?: string;
}

/** Bloc de chargement décoratif ; annoncer le chargement ailleurs (aria-busy, texte). */
export function Skeleton({ width = '100%', height = 16, circle = false, className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(styles.skeleton, circle && styles.circle, className)}
      style={{ width, height }}
    />
  );
}
