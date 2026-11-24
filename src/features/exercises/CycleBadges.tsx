import type { CycleId } from '@/domain/model';
import { cx } from '@/ui/cx';
import styles from './CycleBadges.module.css';

/** Pastilles citron « Cycle A » / « Cycle B » (maquette Exercice) ; `compact` : « A » / « B ». */
export function CycleBadges({ cycles, compact = false }: { cycles: CycleId[]; compact?: boolean }) {
  if (cycles.length === 0) return null;
  return (
    <span className={styles.badges}>
      {cycles.map((c) => (
        <span key={c} className={cx(styles.badge, compact && styles.compact)}>
          {compact ? (
            <>
              <span className="visually-hidden">Cycle </span>
              {c}
            </>
          ) : (
            `Cycle ${c}`
          )}
        </span>
      ))}
    </span>
  );
}
