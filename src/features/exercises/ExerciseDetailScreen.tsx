import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteExercise, useExercises, usePerformances, useSessions } from '@/data/queries';
import type { Exercise } from '@/domain/model';
import { Button, Icon, Sheet, Skeleton, useToast } from '@/ui';
import { CoachNotesField } from './CoachNotesField';
import { CycleBadgesFor } from './CycleBadges';
import { SessionsError } from './SessionsError';
import { cyclesFor } from './exerciseLogic';
import { MuscleMap } from './MuscleMap';
import { VariantsSection, type PerfState } from './VariantsSection';
import styles from './ExerciseDetailScreen.module.css';

function TopBar({ exerciseId }: { exerciseId?: string }) {
  return (
    <div className={styles.topBar}>
      <Link to="/exercises" aria-label="Retour aux exercices" className={styles.round}>
        <Icon name="back" size={20} />
      </Link>
      {exerciseId && (
        <Link to={`/records/${exerciseId}`} className={styles.recordsLink}>
          <Icon name="table" size={18} />
          Records
        </Link>
      )}
    </div>
  );
}

/** Fiche exercice (maquette Exercice.dc.html). */
export function ExerciseDetailScreen() {
  const { id = '' } = useParams();
  const exercises = useExercises();
  const exercise = exercises.data?.find((e) => e.id === id);

  if (exercises.isPending) {
    return (
      <div className={styles.screen}>
        <TopBar />
        <h1 className="visually-hidden">Fiche exercice</h1>
        <div role="status" className={styles.loading}>
          <span className="visually-hidden">Chargement de l’exercice…</span>
          <Skeleton height={44} width="60%" />
          <Skeleton height={72} />
          <Skeleton height={160} />
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className={styles.screen}>
        <TopBar />
        <h1 className={styles.title}>{exercises.isError ? 'Fiche indisponible' : 'Exercice introuvable'}</h1>
        <p className={styles.sheetText} role={exercises.isError ? 'alert' : undefined}>
          {exercises.isError
            ? 'Impossible de charger les exercices. Vérifie ta connexion puis réessaie.'
            : 'Cet exercice n’existe plus ou le lien est incorrect.'}
        </p>
      </div>
    );
  }

  return <ExerciseDetail key={exercise.id} exercise={exercise} />;
}

function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const sessions = useSessions();
  const performances = usePerformances();
  const remove = useDeleteExercise();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const cycles = sessions.isSuccess ? cyclesFor(exercise.id, sessions.data) : [];
  const perfs: PerfState = performances.isSuccess
    ? { status: 'success', data: performances.data }
    : performances.isError
      ? {
          status: 'error',
          retry: () => {
            void performances.refetch();
          },
        }
      : { status: 'pending' };

  const doDelete = () => {
    setDeleteError(null);
    remove.mutate(exercise.id, {
      onSuccess: () => {
        toast.show('Exercice supprimé. Tes performances sont conservées.', 'success');
        void navigate('/exercises');
      },
      onError: (error) => {
        setDeleteError(error.message || 'La suppression a échoué.');
      },
    });
  };

  return (
    <div className={styles.screen}>
      <TopBar exerciseId={exercise.id} />

      <div className={styles.head}>
        <h1 className={styles.title}>{exercise.name}</h1>
        <div className={styles.tags}>
          <CycleBadgesFor state={sessions.status} cycles={cycles} />
          {exercise.muscleGroups.map((m) => (
            <span key={m} className={styles.muscle}>
              {m}
            </span>
          ))}
        </div>
        {sessions.isError && (
          <SessionsError
            onRetry={() => {
              void sessions.refetch();
            }}
          />
        )}
      </div>

      <CoachNotesField exercise={exercise} />

      <VariantsSection exercise={exercise} perfs={perfs} />

      <MuscleMap muscles={exercise.muscleGroups} />

      <Button
        variant="danger"
        icon="trash"
        fullWidth
        onClick={() => {
          setConfirmDelete(true);
        }}
      >
        Supprimer l’exercice
      </Button>

      <Sheet
        open={confirmDelete}
        role="alertdialog"
        title={`Supprimer « ${exercise.name} » ?`}
        aria-describedby="delete-exercise-text"
        onClose={() => {
          setConfirmDelete(false);
        }}
        footer={
          <div className={styles.sheetActions}>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => {
                setConfirmDelete(false);
              }}
            >
              Annuler
            </Button>
            <Button variant="danger" size="lg" fullWidth loading={remove.isPending} onClick={doDelete}>
              Supprimer
            </Button>
          </div>
        }
      >
        <p id="delete-exercise-text" className={styles.sheetText}>
          L’exercice est retiré de la liste et de tes séances, avec ses variantes et les remarques du coach. Tes
          performances déjà enregistrées ne sont pas effacées, mais elles ne seront plus rattachées à une fiche.
        </p>
        {deleteError && (
          <p role="alert" className={styles.fieldError}>
            {deleteError}
          </p>
        )}
      </Sheet>
    </div>
  );
}
