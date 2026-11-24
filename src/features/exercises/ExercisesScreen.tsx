import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useExercises, useSessions } from '@/data/queries';
import { MUSCLE_CATALOG } from '@/domain/muscles';
import { Chip, EmptyState, Icon, IconButton, Skeleton } from '@/ui';
import { CreateExerciseSheet } from './CreateExerciseSheet';
import { CycleBadges } from './CycleBadges';
import { cyclesFor, filterExercises } from './exerciseLogic';
import styles from './ExercisesScreen.module.css';

export function ExercisesScreen() {
  const exercises = useExercises();
  const sessions = useSessions();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => exercises.data ?? [], [exercises.data]);
  const list = useMemo(() => filterExercises(all, query, muscle), [all, query, muscle]);
  const sessionList = sessions.data ?? [];

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Exercices</h1>
          {exercises.data && (
            <p className={styles.count}>
              {list.length === all.length
                ? `${String(all.length)} exercice${all.length > 1 ? 's' : ''}`
                : `${String(list.length)} sur ${String(all.length)}`}
            </p>
          )}
        </div>
        <IconButton
          icon="plus"
          label="Créer un exercice"
          variant="primary"
          className={styles.add}
          onClick={() => {
            setCreating(true);
          }}
        />
      </header>

      <label className={styles.search}>
        <Icon name="search" size={18} />
        <span className="visually-hidden">Rechercher un exercice</span>
        <input
          type="search"
          value={query}
          placeholder="Nom ou muscle…"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
      </label>

      <div className={styles.filters} role="group" aria-label="Filtrer par muscle">
        <Chip
          selected={muscle === null}
          onClick={() => {
            setMuscle(null);
          }}
        >
          Tous
        </Chip>
        {MUSCLE_CATALOG.map((m) => (
          <Chip
            key={m}
            selected={muscle === m}
            onClick={() => {
              setMuscle(muscle === m ? null : m);
            }}
          >
            {m}
          </Chip>
        ))}
      </div>

      {exercises.isPending && (
        <div className={styles.loading} role="status">
          <span className="visually-hidden">Chargement des exercices…</span>
          <Skeleton height={52} />
          <Skeleton height={52} />
          <Skeleton height={52} />
        </div>
      )}
      {exercises.isError && (
        <p role="alert" className={styles.error}>
          Impossible de charger les exercices. Vérifie ta connexion puis réessaie.
        </p>
      )}

      {exercises.data &&
        (list.length === 0 ? (
          <EmptyState
            icon="search"
            title="Aucun exercice trouvé"
            message={all.length === 0 ? 'Crée ton premier exercice avec le bouton +.' : 'Essaie une autre recherche ou un autre muscle.'}
          />
        ) : (
          <ul className={styles.list}>
            {list.map((e) => (
              <li key={e.id}>
                <Link to={`/exercises/${e.id}`} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{e.name}</span>
                    <span className={styles.rowMeta}>
                      {e.muscleGroups.length > 0 ? e.muscleGroups.join(' · ') : 'Aucun muscle'}
                    </span>
                  </span>
                  <span>
                    <CycleBadges cycles={cyclesFor(e.id, sessionList)} compact />
                  </span>
                  <Icon name="chevron" size={16} className={styles.chevron} />
                </Link>
              </li>
            ))}
          </ul>
        ))}

      <CreateExerciseSheet
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
      />
    </div>
  );
}
