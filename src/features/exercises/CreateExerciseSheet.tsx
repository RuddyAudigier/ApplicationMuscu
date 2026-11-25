import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateExercise } from '@/data/queries';
import { Button, Sheet, useToast } from '@/ui';
import { ExerciseForm, infoErrors } from './ExerciseForm';
import { createDraft, errorText, type ExerciseInfo } from './exerciseLogic';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY: ExerciseInfo = { name: '', description: '', muscleGroups: [] };

/** Création d'exercice : nom, description, muscles ; la variante « Classique » est créée d'office. */
export function CreateExerciseSheet({ open, onClose }: Props) {
  const create = useCreateExercise();
  const navigate = useNavigate();
  const toast = useToast();
  const [info, setInfo] = useState<ExerciseInfo>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const close = () => {
    setInfo(EMPTY);
    setSubmitted(false);
    setServerError(null);
    onClose();
  };

  const submit = () => {
    setSubmitted(true);
    setServerError(null);
    if (infoErrors(info)) return;
    create.mutate(createDraft(info.name, info.muscleGroups, info.description), {
      onSuccess: (exercise) => {
        toast.show('Exercice créé.', 'success');
        close();
        void navigate(`/exercises/${exercise.id}`);
      },
      onError: (error) => {
        setServerError(errorText('Création impossible', error));
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
      <ExerciseForm
        id="create-exercise"
        value={info}
        onChange={setInfo}
        submitted={submitted}
        serverError={serverError}
        onSubmit={submit}
      />
    </Sheet>
  );
}
