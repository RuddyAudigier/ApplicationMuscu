import type { CycleId } from '@/domain/model';
import { cx, Skeleton } from '@/ui';
import styles from './CycleBadges.module.css';

/** Séances chargées ou non : jamais de pastilles déduites d'une liste de repli vide. */
export type CyclesState = 'pending' | 'error' | 'success';

/** Pastilles d'après l'état des séances : squelette en attente, rien en erreur (message ailleurs). */
export function CycleBadgesFor({ state, cycles, compact = false }: { state: CyclesState; cycles: CycleId[]; compact?: boolean }) {
  if (state === 'pending') return <Skeleton width={compact ? 24 : 64} height={24} circle={compact} />;
  if (state === 'error') return null;
  return <CycleBadges cycles={cycles} compact={compact} />;
}

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
