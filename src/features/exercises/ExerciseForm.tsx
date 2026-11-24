import type { SyntheticEvent } from 'react';
import { MUSCLE_CATALOG } from '@/domain/muscles';
import { Chip, Field } from '@/ui';
import type { ExerciseInfo } from './exerciseLogic';
import styles from './ExercisesScreen.module.css';

interface Props {
  /** id du formulaire (bouton d'envoi placé dans le pied du Sheet). */
  id: string;
  value: ExerciseInfo;
  onChange: (value: ExerciseInfo) => void;
  /** Erreurs de saisie affichées après une première tentative d'envoi. */
  submitted: boolean;
  serverError: string | null;
  onSubmit: () => void;
}

/** Nom, description et muscles d'un exercice : `null` si la saisie est valide. */
export function infoErrors(value: ExerciseInfo): { name?: string; muscles?: string } | null {
  const errors = {
    ...(value.name.trim() ? {} : { name: 'Le nom de l’exercice est requis.' }),
    ...(value.muscleGroups.length > 0 ? {} : { muscles: 'Choisis au moins un muscle.' }),
  };
  return Object.keys(errors).length > 0 ? errors : null;
}

/** Formulaire commun à la création et à la modification d'un exercice. */
export function ExerciseForm({ id, value, onChange, submitted, serverError, onSubmit }: Props) {
  const errors = submitted ? infoErrors(value) : null;
  const musclesErrorId = `${id}-muscles-error`;

  const toggle = (m: string) => {
    const list = value.muscleGroups;
    onChange({ ...value, muscleGroups: list.includes(m) ? list.filter((x) => x !== m) : [...list, m] });
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form id={id} className={styles.form} onSubmit={submit} noValidate>
      <Field
        label="Nom"
        value={value.name}
        placeholder="Ex. Curl incliné"
        autoComplete="off"
        error={errors?.name}
        onChange={(e) => {
          onChange({ ...value, name: e.target.value });
        }}
      />
      <Field
        as="textarea"
        label="Description"
        hint="Facultatif : réglages, placement, consignes."
        value={value.description}
        rows={3}
        onChange={(e) => {
          onChange({ ...value, description: e.target.value });
        }}
      />
      <fieldset className={styles.fieldset} aria-describedby={errors?.muscles ? musclesErrorId : undefined}>
        <legend className={styles.legend}>Muscles</legend>
        <div className={styles.chips}>
          {/* Muscles hors catalogue (anciennes fiches) : visibles pour pouvoir les retirer. */}
          {[...MUSCLE_CATALOG, ...value.muscleGroups.filter((m) => !MUSCLE_CATALOG.includes(m))].map((m) => (
            <Chip
              key={m}
              selected={value.muscleGroups.includes(m)}
              onClick={() => {
                toggle(m);
              }}
            >
              {m}
            </Chip>
          ))}
        </div>
        {errors?.muscles && (
          <p id={musclesErrorId} className={styles.fieldError}>
            {errors.muscles}
          </p>
        )}
      </fieldset>
      {serverError && (
        <p role="alert" className={styles.fieldError}>
          {serverError}
        </p>
      )}
    </form>
  );
}
