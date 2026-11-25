import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteExercise, useExercises, usePerformances, useSessions } from '@/data/queries';
import type { Exercise } from '@/domain/model';
import { Button, Icon, iconButtonClasses, PageHeader, Sheet, Skeleton, useToast } from '@/ui';
import { CoachNotesField } from './CoachNotesField';
import { CycleBadgesFor } from './CycleBadges';
import { EditExerciseSheet } from './EditExerciseSheet';
import { SessionsError } from './SessionsError';
import { cyclesFor, errorText, hasExercisePerformances } from './exerciseLogic';
import { MuscleMap } from './MuscleMap';
import { VariantsSection, type PerfState } from './VariantsSection';
import styles from './ExerciseDetailScreen.module.css';

function TopBar({ exerciseId, title = 'Exercice', heading = false }: { exerciseId?: string; title?: string; heading?: boolean }) {
  const navigate = useNavigate();
  return (
    <PageHeader
      title={title}
      decorative={!heading}
      onBack={() => {
        void navigate('/exercises');
      }}
      actions={
        exerciseId && (
          <Link to={`/records/${exerciseId}`} aria-label="Records" title="Records" className={iconButtonClasses('surface')}>
            <Icon name="table" size={22} />
          </Link>
        )
      }
    />
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
        <TopBar heading title={exercises.isError ? 'Fiche indisponible' : 'Exercice introuvable'} />
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
  const [editing, setEditing] = useState(false);

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

  // C2 : suppression seulement si l'historique est chargé et vide (cascade en base non vérifiée).
  const hasHistory = performances.isSuccess ? hasExercisePerformances(exercise.id, performances.data) : null;

  const doDelete = () => {
    if (hasHistory !== false) return;
    setDeleteError(null);
    remove.mutate(exercise.id, {
      onSuccess: () => {
        toast.show('Exercice supprimé.', 'success');
        void navigate('/exercises');
      },
      onError: (error) => {
        setDeleteError(errorText('Suppression impossible', error));
      },
    });
  };
  const closeDelete = () => {
    setConfirmDelete(false);
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
        {exercise.description.trim() !== '' && <p className={styles.description}>{exercise.description}</p>}
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
        variant="secondary"
        icon="edit"
        fullWidth
        onClick={() => {
          setEditing(true);
        }}
      >
        Modifier l’exercice
      </Button>

      <Button
        variant="danger"
        icon="trash"
        fullWidth
        disabled={hasHistory === null}
        aria-describedby={performances.isError ? 'delete-exercise-unavailable' : undefined}
        onClick={() => {
          setConfirmDelete(true);
        }}
      >
        Supprimer l’exercice
      </Button>
      {performances.isError && (
        <p id="delete-exercise-unavailable" className={styles.sheetText}>
          Historique indisponible : suppression impossible pour l’instant.
        </p>
      )}

      {editing && (
        <EditExerciseSheet
          exercise={exercise}
          onClose={() => {
            setEditing(false);
          }}
        />
      )}

      {hasHistory ? (
        <Sheet
          open={confirmDelete}
          role="alertdialog"
          title="Suppression impossible"
          aria-describedby="delete-exercise-text"
          onClose={closeDelete}
          footer={
            <Button variant="accent" size="lg" fullWidth onClick={closeDelete}>
              Compris
            </Button>
          }
        >
          <p id="delete-exercise-text" className={styles.sheetText}>
            Cet exercice a des performances enregistrées : il ne peut pas être supprimé pour ne pas risquer ton
            historique. Renomme-le plutôt.
          </p>
        </Sheet>
      ) : (
        <Sheet
          open={confirmDelete}
          role="alertdialog"
          title={`Supprimer « ${exercise.name} » ?`}
          aria-describedby="delete-exercise-text"
          onClose={closeDelete}
          footer={
            <div className={styles.sheetActions}>
              <Button variant="secondary" size="lg" fullWidth onClick={closeDelete}>
                Annuler
              </Button>
              <Button variant="danger" size="lg" fullWidth loading={remove.isPending} onClick={doDelete}>
                Supprimer
              </Button>
            </div>
          }
        >
          <p id="delete-exercise-text" className={styles.sheetText}>
            L’exercice est retiré de la liste et de tes séances, avec ses variantes et les remarques du coach.
            Aucune performance n’est enregistrée pour lui.
          </p>
          {deleteError && (
            <p role="alert" className={styles.fieldError}>
              {deleteError}
            </p>
          )}
        </Sheet>
      )}
    </div>
  );
}
