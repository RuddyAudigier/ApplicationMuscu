import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCreateExercise } from '@/data/queries';
import { MUSCLE_CATALOG } from '@/domain/muscles';
import { Button, Chip, Field, Sheet, useToast } from '@/ui';
import { createDraft } from './exerciseLogic';
import styles from './ExercisesScreen.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Création d'exercice : nom + muscles ; la variante « Classique » est créée d'office. */
export function CreateExerciseSheet({ open, onClose }: Props) {
  const create = useCreateExercise();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nameError = submitted && !name.trim() ? "Le nom de l'exercice est requis." : undefined;
  const musclesError = submitted && muscles.length === 0 ? 'Choisis au moins un muscle.' : null;

  const close = () => {
    setName('');
    setMuscles([]);
    setSubmitted(false);
    setServerError(null);
    onClose();
  };

  const toggle = (m: string) => {
    setMuscles((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!name.trim() || muscles.length === 0) return;
    create.mutate(createDraft(name, muscles), {
      onSuccess: (exercise) => {
        toast.show('Exercice créé.', 'success');
        close();
        void navigate(`/exercises/${exercise.id}`);
      },
      onError: (error) => {
        setServerError(error.message || "La création de l'exercice a échoué.");
      },
    });
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Nouvel exercice"
      footer={
        <Button type="submit" form="create-exercise" variant="accent" size="lg" fullWidth loading={create.isPending}>
          Créer l’exercice
        </Button>
      }
    >
      <form id="create-exercise" className={styles.form} onSubmit={submit} noValidate>
        <Field
          label="Nom"
          value={name}
          placeholder="Ex. Curl incliné"
          autoComplete="off"
          error={nameError}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <fieldset className={styles.fieldset} aria-describedby={musclesError ? 'create-muscles-error' : undefined}>
          <legend className={styles.legend}>Muscles</legend>
          <div className={styles.chips}>
            {MUSCLE_CATALOG.map((m) => (
              <Chip
                key={m}
                selected={muscles.includes(m)}
                onClick={() => {
                  toggle(m);
                }}
              >
                {m}
              </Chip>
            ))}
          </div>
          {musclesError && (
            <p id="create-muscles-error" className={styles.fieldError}>
              {musclesError}
            </p>
          )}
        </fieldset>
        {serverError && (
          <p role="alert" className={styles.fieldError}>
            {serverError}
          </p>
        )}
      </form>
    </Sheet>
  );
}
