import { useState } from 'react';
import { useUpdateExercise } from '@/data/queries';
import type { Exercise } from '@/domain/model';
import { Button, Sheet, useToast } from '@/ui';
import { ExerciseForm, infoErrors } from './ExerciseForm';
import { errorText, infoDraft, type ExerciseInfo } from './exerciseLogic';

interface Props {
  exercise: Exercise;
  onClose: () => void;
}

/** Modification de la fiche (nom, description, muscles) ; brouillon complet, variantes inchangées. */
export function EditExerciseSheet({ exercise, onClose }: Props) {
  const update = useUpdateExercise(exercise.id);
  const toast = useToast();
  const [info, setInfo] = useState<ExerciseInfo>({
    name: exercise.name,
    description: exercise.description,
    muscleGroups: exercise.muscleGroups,
  });
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = () => {
    setSubmitted(true);
    setServerError(null);
    if (infoErrors(info) || update.isPending) return;
    update.mutate(
      { id: exercise.id, draft: infoDraft(exercise, info) },
      {
        onSuccess: () => {
          toast.show('Exercice modifié.', 'success');
          onClose();
        },
        onError: (error) => {
          setServerError(errorText('Modification impossible', error));
        },
      },
    );
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Modifier l’exercice"
      footer={
        <Button type="submit" form="edit-exercise" variant="accent" size="lg" fullWidth loading={update.isPending}>
          Enregistrer
        </Button>
      }
    >
      <ExerciseForm
        id="edit-exercise"
        value={info}
        onChange={setInfo}
        submitted={submitted}
        serverError={serverError}
        onSubmit={submit}
      />
    </Sheet>
  );
}
