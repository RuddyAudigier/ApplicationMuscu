import { useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router';
import { useUpdateExercise } from '@/data/queries';
import type { Exercise, Performance, Variant } from '@/domain/model';
import { variantLabel } from '@/domain/variants';
import { Button, Field, Icon, Sheet, Skeleton, useToast } from '@/ui';
import {
  draftWith,
  formatKg,
  newVariant,
  removeVariant,
  renameVariant,
  variantKey,
  variantMeta,
  variantNameError,
  variantStats,
  type VariantStat,
} from './exerciseLogic';
import styles from './ExerciseDetailScreen.module.css';

/** État de la requête des performances : les stats ne s'affichent qu'une fois chargées. */
export type PerfState =
  | { status: 'pending' }
  | { status: 'error'; retry: () => void }
  | { status: 'success'; data: Performance[] };

interface Props {
  exercise: Exercise;
  perfs: PerfState;
}

/** Variantes : meilleur e1RM, ajout sans limite, renommage, suppression (sauf « Classique »). */
export function VariantsSection({ exercise, perfs }: Props) {
  const update = useUpdateExercise(exercise.id);
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const busy = update.isPending;

  const stats: VariantStat[] | null = perfs.status === 'success' ? variantStats(exercise, perfs.data) : null;
  const current = selected === null ? null : (exercise.variants.find((v) => variantKey(v) === selected) ?? null);
  const currentStat = current && stats ? (stats.find((s) => variantKey(s.variant) === selected) ?? null) : null;

  const saveVariants = (variants: Variant[], onDone: () => void, onFail: (message: string) => void) => {
    update.mutate(
      { id: exercise.id, draft: draftWith(exercise, variants) },
      {
        onSuccess: onDone,
        onError: (error) => {
          onFail(error.message || 'La modification des variantes a échoué.');
        },
      },
    );
  };

  const add = (event: SyntheticEvent) => {
    event.preventDefault();
    if (busy) return;
    const error = variantNameError(newName, exercise.variants);
    setAddError(error);
    if (error) return;
    saveVariants(
      [...exercise.variants, newVariant(exercise, newName)],
      () => {
        setNewName('');
        toast.show('Variante ajoutée.', 'success');
      },
      setAddError,
    );
  };

  return (
    <section className={styles.variants} aria-labelledby="variants-title" aria-busy={busy || undefined}>
      <div className={styles.variantsHead}>
        <h2 id="variants-title" className={styles.sectionLabel}>
          Variantes · records séparés
        </h2>
        <span className={styles.sectionLabel} aria-hidden="true">
          Meilleur e1RM
        </span>
      </div>
      {perfs.status === 'error' && (
        <div role="alert" className={styles.inlineError}>
          <span>Records indisponibles : impossible de charger les performances.</span>
          <Button variant="ghost" onClick={perfs.retry}>
            Réessayer
          </Button>
        </div>
      )}
      <ul className={styles.variantList}>
        {exercise.variants.map((v) => {
          const stat = stats?.find((s) => variantKey(s.variant) === variantKey(v)) ?? null;
          const label = variantLabel(v.name);
          return (
            <li key={variantKey(v)}>
              <button
                type="button"
                className={styles.variantRow}
                disabled={busy}
                // Le nom reprend le texte visible dans l'ordre (WCAG 2.5.3).
                aria-label={
                  stat
                    ? `${label}, ${variantMeta(stat)}, ${formatKg(stat.bestE1rm)} (meilleur e1RM). Gérer la variante`
                    : `${label}${v.isDefault ? ', par défaut' : ''}. Gérer la variante`
                }
                onClick={() => {
                  setSelected(variantKey(v));
                }}
              >
                <span className={styles.variantText}>
                  <span className={styles.variantName}>{label}</span>{' '}
                  {stat ? (
                    <span className={styles.variantMeta}>{variantMeta(stat)}</span>
                  ) : perfs.status === 'pending' ? (
                    <Skeleton width={96} height={12} />
                  ) : (
                    <span className={styles.variantMeta}>{v.isDefault ? 'Par défaut' : ''}</span>
                  )}
                </span>{' '}
                {stat ? (
                  <span className={styles.variantBest}>{formatKg(stat.bestE1rm)}</span>
                ) : perfs.status === 'pending' ? (
                  <Skeleton width={56} height={20} />
                ) : (
                  <span className={styles.variantBest}>—</span>
                )}
                <Icon name="chevron" size={16} className={styles.chevron} />
              </button>
            </li>
          );
        })}
      </ul>

      <form className={styles.addRow} onSubmit={add} noValidate>
        <label className={styles.addField}>
          <span className="visually-hidden">Nom de la nouvelle variante</span>
          <input
            type="text"
            value={newName}
            placeholder="Nouvelle variante…"
            autoComplete="off"
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? 'add-variant-error' : undefined}
            onChange={(e) => {
              setNewName(e.target.value);
              setAddError(null);
            }}
          />
        </label>
        <button type="submit" className={styles.addButton} aria-label="Ajouter la variante" disabled={busy}>
          <Icon name="plus" size={22} />
        </button>
      </form>
      {addError && (
        <p id="add-variant-error" role="alert" className={styles.fieldError}>
          {addError}
        </p>
      )}

      {current && (
        <VariantSheet
          key={variantKey(current)}
          exercise={exercise}
          variant={current}
          stat={currentStat}
          busy={busy}
          onClose={() => {
            setSelected(null);
          }}
          onSave={(variants, message, onFail) => {
            saveVariants(
              variants,
              () => {
                setSelected(null);
                toast.show(message, 'success');
              },
              onFail,
            );
          }}
        />
      )}
    </section>
  );
}

interface SheetProps {
  exercise: Exercise;
  variant: Variant;
  stat: VariantStat | null;
  busy: boolean;
  onClose: () => void;
  onSave: (variants: Variant[], message: string, onFail: (message: string) => void) => void;
}

function VariantSheet({ exercise, variant, stat, busy, onClose, onSave }: SheetProps) {
  const key = variantKey(variant);
  const label = variantLabel(variant.name);
  const [name, setName] = useState(variant.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const records = `/records/${exercise.id}`;

  const rename = (event: SyntheticEvent) => {
    event.preventDefault();
    if (busy) return;
    const err = variantNameError(name, exercise.variants, key);
    setError(err);
    if (err) return;
    if (name.trim() === variant.name) {
      onClose();
      return;
    }
    onSave(renameVariant(exercise.variants, key, name), 'Variante renommée.', setError);
  };

  const remove = () => {
    if (busy) return;
    onSave(removeVariant(exercise.variants, key), 'Variante supprimée. Ses records sont conservés.', (message) => {
      setConfirming(false);
      setError(message);
    });
  };

  if (confirming) {
    return (
      <Sheet
        open
        role="alertdialog"
        title={`Supprimer « ${label} » ?`}
        aria-describedby="delete-variant-text"
        onClose={() => {
          setConfirming(false);
        }}
        footer={
          <div className={styles.sheetActions}>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              disabled={busy}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Annuler
            </Button>
            <Button variant="danger" size="lg" fullWidth loading={busy} onClick={remove}>
              Supprimer
            </Button>
          </div>
        }
      >
        <p id="delete-variant-text" className={styles.sheetText}>
          La variante disparaît de la fiche et de la séance. Ses records
          {stat && stat.records > 0 ? ` (${String(stat.records)})` : ''} ne sont pas effacés : l’historique est
          conservé en base, mais ils ne seront plus affichés dans l’application.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet open title={label} onClose={onClose}>
      <div className={styles.sheetBody}>
        {stat && (
          <p className={styles.sheetText}>
            {variantMeta(stat)} · meilleur e1RM {formatKg(stat.bestE1rm)}
          </p>
        )}
        {variant.isDefault ? (
          <p className={styles.sheetText}>
            « Classique » est la variante par défaut, elle ne peut pas être supprimée. Elle n’est pas renommable :
            ses records, dont les plus anciens, sont aussi rattachés à son nom d’origine « Touch and Go », qui doit
            rester stable pour les retrouver.
          </p>
        ) : (
          <form className={styles.renameForm} onSubmit={rename} noValidate>
            <Field
              label="Nom de la variante"
              value={name}
              autoComplete="off"
              error={error ?? undefined}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            <Button type="submit" variant="accent" size="lg" fullWidth loading={busy}>
              Renommer
            </Button>
          </form>
        )}
        <Link to={records} className={styles.sheetLink}>
          <Icon name="table" size={18} />
          Voir le tableau des records
        </Link>
        {!variant.isDefault && (
          <Button
            variant="danger"
            icon="trash"
            fullWidth
            disabled={busy}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Supprimer la variante
          </Button>
        )}
      </div>
    </Sheet>
  );
}
