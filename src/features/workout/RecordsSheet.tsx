import { isoToShortFr, todayIso } from '@/domain/dates';
import type { Performance, Variant } from '@/domain/model';
import { formatDecimal, formatWeight } from '@/domain/numbers';
import { variantLabel } from '@/domain/variants';
import { recordsTable, type RecordRow } from '@/domain/workout';
import { cx, Pill, Sheet } from '@/ui';
import { isSameVariant, variantKeyOf } from './livePr';
import styles from './WorkoutScreen.module.css';

export interface RecordsSheetProps {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  variants: Variant[];
  /** Variante de la série en cours (pastille sélectionnée). */
  variantKey: string;
  /** Pastille touchée : la série passe sur cette variante (cible effacée). */
  onSelectVariant: (variant: Variant) => void;
  /** Reps de la cible actuelle (ligne surlignée). */
  targetReps: number | null;
  perfs: Performance[];
  onPick: (row: RecordRow, variant: Variant) => void;
}

/** « Mes records » : pastilles de variantes fixes, tableau 1–30 défilant ; toucher une ligne = cible. */
export function RecordsSheet(props: RecordsSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Mes records">
      <RecordsBody {...props} />
    </Sheet>
  );
}

const shortDate = (iso: string | null): string => (iso === null ? '' : iso === todayIso() ? 'auj.' : isoToShortFr(iso));
/** Date du nom accessible : reprend le texte visible (« auj. » compris, WCAG 2.5.3). */
const dateLabel = (iso: string | null): string => {
  if (iso === null) return '';
  const visible = shortDate(iso);
  return visible === 'auj.' ? ', auj.' : `, le ${visible}`;
};

function RecordsBody({
  exerciseId,
  exerciseName,
  variants,
  variantKey,
  onSelectVariant,
  targetReps,
  perfs,
  onPick,
}: RecordsSheetProps) {
  // Comme la maquette (pickInSheet) : le tableau suit la variante de la série en cours.
  const variant = variants.find((v) => isSameVariant(v, variantKey)) ?? variants[0];
  const rows = variant ? recordsTable(perfs, exerciseId, variant) : [];

  return (
    <div className={styles.records}>
      <p className={styles.recordsSub}>{exerciseName} · touche ta cible</p>
      <div role="radiogroup" aria-label="Variante du tableau" className={styles.sheetPills}>
        {variants.map((v) => (
          <Pill
            key={variantKeyOf(v)}
            tone="accent"
            selected={variant !== undefined && variantKeyOf(v) === variantKeyOf(variant)}
            onSelect={() => {
              onSelectVariant(v);
            }}
          >
            {variantLabel(v.name)}
          </Pill>
        ))}
      </div>
      <div className={styles.tableHead} aria-hidden="true">
        <span>Reps</span>
        <span>Record</span>
        <span>RPE</span>
        <span className={styles.right}>Date</span>
      </div>
      <ul className={styles.table} aria-label={`Records ${variant ? variantLabel(variant.name) : ''}`}>
        {rows.map((row) => {
          const selected = targetReps === row.reps;
          const repsLabel = `${String(row.reps)} rep${row.reps > 1 ? 's' : ''}`;
          const label =
            row.weight === null
              ? `${repsLabel} : à conquérir, viser un premier record`
              : `${repsLabel} : ${formatWeight(row.weight)} kg${row.rpe === null ? '' : `, RPE ${formatDecimal(row.rpe)}`}${dateLabel(row.date)}`;
          return (
            <li key={row.reps}>
              <button
                type="button"
                className={cx(styles.row, selected && styles.rowSelected)}
                aria-pressed={selected}
                onClick={() => {
                  if (variant) onPick(row, variant);
                }}
              >
                {/* Nom tiré du contenu (pas d'aria-label) : la phrase lue reprend le texte visible
                    dans l'ordre (WCAG 2.5.3) ; les colonnes visibles ne sont pas lues en double. */}
                <span className="visually-hidden">{label}</span>
                <span className={styles.rowReps} aria-hidden="true">{repsLabel}</span>
                <span className={row.weight === null ? styles.rowEmpty : styles.rowWeight} aria-hidden="true">
                  {row.weight === null ? 'à conquérir' : `${formatWeight(row.weight)} kg`}
                </span>
                <span className={styles.rowMeta} aria-hidden="true">{formatDecimal(row.rpe)}</span>
                <span className={cx(styles.rowMeta, styles.right)} aria-hidden="true">{shortDate(row.date)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
