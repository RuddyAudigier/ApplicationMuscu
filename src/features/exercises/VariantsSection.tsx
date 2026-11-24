import { useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router';
import { useUpdateExercise } from '@/data/queries';
import type { Exercise, Performance, Variant } from '@/domain/model';
import { Button, Field, Icon, Sheet, useToast } from '@/ui';
import {
  draftWith,
  formatKg,
  newVariant,
  variantMeta,
  variantNameError,
  variantStats,
  type VariantStat,
} from './exerciseLogic';
import styles from './ExerciseDetailScreen.module.css';

interface Props {
  exercise: Exercise;
  performances: Performance[];
}

/** Variantes : meilleur e1RM, ajout sans limite, renommage, suppression (sauf « Classique »). */
export function VariantsSection({ exercise, performances }: Props) {
  const update = useUpdateExercise();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const stats = variantStats(exercise, performances);

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

  const current = selected === null ? null : (stats[selected] ?? null);

  return (
    <section className={styles.variants} aria-labelledby="variants-title">
      <div className={styles.variantsHead}>
        <h2 id="variants-title" className={styles.sectionLabel}>
          Variantes · records séparés
        </h2>
        <span className={styles.sectionLabel} aria-hidden="true">
          Meilleur e1RM
        </span>
      </div>
      <ul className={styles.variantList}>
        {stats.map((s, i) => (
          <li key={s.variant.id ?? s.variant.name}>
            <button
              type="button"
              className={styles.variantRow}
              aria-label={`${s.label}, ${variantMeta(s)}, meilleur e1RM ${formatKg(s.bestE1rm)}. Gérer la variante`}
              onClick={() => {
                setSelected(i);
              }}
            >
              <span className={styles.variantText}>
                <span className={styles.variantName}>{s.label}</span>
                <span className={styles.variantMeta}>{variantMeta(s)}</span>
              </span>
              <span className={styles.variantBest}>{formatKg(s.bestE1rm)}</span>
              <Icon name="chevron" size={16} className={styles.chevron} />
            </button>
          </li>
        ))}
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
        <button type="submit" className={styles.addButton} aria-label="Ajouter la variante" disabled={update.isPending}>
          <Icon name="plus" size={22} />
        </button>
      </form>
      {addError && (
        <p id="add-variant-error" role="alert" className={styles.fieldError}>
          {addError}
        </p>
      )}

      {current && selected !== null && (
        <VariantSheet
          key={current.variant.id ?? current.variant.name}
          exercise={exercise}
          stat={current}
          index={selected}
          pending={update.isPending}
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
  stat: VariantStat;
  index: number;
  pending: boolean;
  onClose: () => void;
  onSave: (variants: Variant[], message: string, onFail: (message: string) => void) => void;
}

function VariantSheet({ exercise, stat, index, pending, onClose, onSave }: SheetProps) {
  const [name, setName] = useState(stat.variant.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const isDefault = stat.variant.isDefault;
  const records = `/records/${exercise.id}`;

  const rename = (event: SyntheticEvent) => {
    event.preventDefault();
    const err = variantNameError(name, exercise.variants, index);
    setError(err);
    if (err) return;
    if (name.trim() === stat.variant.name) {
      onClose();
      return;
    }
    const variants = exercise.variants.map((v, i) => (i === index ? { ...v, name: name.trim() } : v));
    onSave(variants, 'Variante renommée.', setError);
  };

  const remove = () => {
    onSave(
      exercise.variants.filter((_, i) => i !== index),
      'Variante supprimée. Ses records sont conservés.',
      (message) => {
        setConfirming(false);
        setError(message);
      },
    );
  };

  if (confirming) {
    return (
      <Sheet
        open
        role="alertdialog"
        title={`Supprimer « ${stat.label} » ?`}
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
              onClick={() => {
                setConfirming(false);
              }}
            >
              Annuler
            </Button>
            <Button variant="danger" size="lg" fullWidth loading={pending} onClick={remove}>
              Supprimer
            </Button>
          </div>
        }
      >
        <p id="delete-variant-text" className={styles.sheetText}>
          La variante disparaît de la fiche et de la séance. Ses records
          {stat.records > 0 ? ` (${String(stat.records)})` : ''} ne sont pas effacés : l’historique est conservé,
          mais ils ne s’afficheront plus, sauf si tu recrées une variante du même nom.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet open title={stat.label} onClose={onClose}>
      <div className={styles.sheetBody}>
        <p className={styles.sheetText}>
          {variantMeta(stat)} · meilleur e1RM {formatKg(stat.bestE1rm)}
        </p>
        {isDefault ? (
          <p className={styles.sheetText}>
            « Classique » est la variante par défaut : elle ne peut être ni renommée ni supprimée.
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
            <Button type="submit" variant="accent" size="lg" fullWidth loading={pending}>
              Renommer
            </Button>
          </form>
        )}
        <Link to={records} className={styles.sheetLink}>
          <Icon name="table" size={18} />
          Voir le tableau des records
        </Link>
        {!isDefault && (
          <Button
            variant="danger"
            icon="trash"
            fullWidth
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
