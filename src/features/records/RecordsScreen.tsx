import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { isoToShortFr, todayIso } from '@/domain/dates';
import { roundE1rm } from '@/domain/e1rm';
import type { Exercise, Performance, Variant } from '@/domain/model';
import { formatWeight } from '@/domain/numbers';
import { progressionFor } from '@/domain/progression';
import { getDefaultVariant, variantLabel, variantMatches } from '@/domain/variants';
import { recordsTable } from '@/domain/workout';
import { useExercises, usePerformances } from '@/data/queries';
import { Button, EmptyState, Pill, Segmented, Skeleton, StatTile } from '@/ui';
import { CsvImportSheet } from './CsvImportSheet';
import { E1rmChart } from './E1rmChart';
import { ExercisePicker } from './ExercisePicker';
import { cx, kg, weekStartIso } from './format';
import styles from './Records.module.css';

type View = 'table' | 'curve';
const EMPTY: Performance[] = [];

/** Exercice affiché : celui de l'URL, sinon le premier ayant des performances, sinon le premier. */
function pickExercise(exercises: Exercise[], perfs: Performance[], id: string | undefined): Exercise | null {
  if (id) {
    const found = exercises.find((e) => e.id === id);
    if (found) return found;
  }
  return exercises.find((e) => perfs.some((p) => p.exerciseId === e.id)) ?? exercises[0] ?? null;
}

function pickVariant(exercise: Exercise, name: string | null): Variant {
  const found = name === null ? undefined : exercise.variants.find((v) => variantMatches(v, { variantId: null, variantName: name }));
  return found ?? getDefaultVariant(exercise.variants);
}

/** Clé de variante attendue par `progressionFor` (libellé en minuscules). */
const progressionKey = (v: Variant): string => (v.name.trim() || 'Touch and Go').toLowerCase();

export function RecordsScreen() {
  const { exerciseId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const exercisesQuery = useExercises();
  const perfsQuery = usePerformances();
  const [view, setView] = useState<View>('table');
  const [menuOpen, setMenuOpen] = useState(false);

  const exercises = useMemo(() => exercisesQuery.data ?? [], [exercisesQuery.data]);
  const perfs = perfsQuery.data ?? EMPTY;
  const exercise = pickExercise(exercises, perfs, exerciseId);
  const variant = exercise ? pickVariant(exercise, params.get('variant')) : null;

  const today = todayIso();
  const weekStart = weekStartIso(today);
  const rows = useMemo(
    () => (exercise && variant ? recordsTable(perfs, exercise.id, variant) : []),
    [perfs, exercise, variant],
  );
  const progression = useMemo(
    () => (exercise && variant ? progressionFor(perfs, exercise.id, progressionKey(variant)) : null),
    [perfs, exercise, variant],
  );

  const loading = exercisesQuery.isPending || perfsQuery.isPending;
  const failed = exercisesQuery.isError || perfsQuery.isError;

  const selectVariant = (v: Variant) => {
    const next = new URLSearchParams(params);
    if (v.isDefault) next.delete('variant');
    else next.set('variant', v.name);
    setParams(next, { replace: true });
  };

  const addHref = exercise
    ? `/records/add?exerciseId=${encodeURIComponent(exercise.id)}${variant && !variant.isDefault ? `&variant=${encodeURIComponent(variant.name)}` : ''}`
    : '/records/add';

  return (
    <div className={styles.screen}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Records</h1>
        <button
          type="button"
          className={styles.moreButton}
          aria-label="Plus d'options"
          aria-haspopup="dialog"
          onClick={() => {
            setMenuOpen(true);
          }}
        >
          <span aria-hidden="true">⋯</span>
        </button>
      </div>

      {loading && <Skeleton height={320} />}
      {!loading && failed && (
        <p role="alert" className={styles.error}>
          Impossible de charger les records. Vérifie ta connexion puis réessaie.
        </p>
      )}
      {!loading && !failed && !exercise && (
        <EmptyState title="Aucun exercice" message="Crée un exercice pour suivre tes records." />
      )}

      {!loading && !failed && exercise && variant && (
        <>
          <div className={styles.exerciseRow}>
            <ExercisePicker
              look="pill"
              exercises={exercises}
              selected={exercise}
              onSelect={(id) => {
                void navigate(`/records/${encodeURIComponent(id)}`);
              }}
            />
          </div>

          <div role="radiogroup" aria-label="Variante" className={styles.variants}>
            {exercise.variants.map((v) => (
              <Pill
                key={v.id ?? v.name}
                tone="accent"
                selected={v.id === variant.id && v.name === variant.name}
                onSelect={() => {
                  selectVariant(v);
                }}
              >
                {variantLabel(v.name)}
              </Pill>
            ))}
          </div>

          <Segmented<View>
            label="Vue"
            options={[
              { value: 'table', label: 'Tableau' },
              { value: 'curve', label: 'Courbe' },
            ]}
            value={view}
            onChange={setView}
          />

          {view === 'table' ? (
            <RecordsTable rows={rows} today={today} weekStart={weekStart} />
          ) : (
            progression && <Curve progression={progression} />
          )}

          <Button
            variant="accent"
            size="lg"
            fullWidth
            icon="plus"
            onClick={() => {
              void navigate(addHref);
            }}
          >
            Ajouter un PR
          </Button>
        </>
      )}

      <CsvImportSheet
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
        }}
        exercises={exercises}
      />
    </div>
  );
}

interface TableProps {
  rows: ReturnType<typeof recordsTable>;
  today: string;
  weekStart: string;
}

function RecordsTable({ rows, today, weekStart }: TableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Records de 1 à 30 répétitions</caption>
        <thead>
          <tr className={styles.headRow}>
            <th scope="col">Reps</th>
            <th scope="col">Poids</th>
            <th scope="col">RPE</th>
            <th scope="col" className={styles.right}>
              Date
            </th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {rows.map((row) => {
            const empty = row.weight === null;
            const fresh = row.date !== null && row.date >= weekStart && row.date <= today;
            return (
              <tr key={row.reps} className={styles.row} data-fresh={fresh || undefined}>
                <th scope="row" className={styles.reps}>
                  {row.reps}
                </th>
                <td className={cx(styles.weight, empty && styles.weightEmpty, fresh && styles.weightFresh)}>
                  {empty ? 'à conquérir' : kg(row.weight ?? 0)}
                  {fresh && <span className={styles.srOnly}> (PR cette semaine)</span>}
                </td>
                <td className={styles.rpe}>{row.rpe ?? ''}</td>
                <td className={cx(styles.date, fresh && styles.dateFresh)}>
                  {row.date === null ? '' : row.date === today ? 'auj.' : isoToShortFr(row.date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.dotFresh} />
          PR cette semaine
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dotEmpty} />À conquérir
        </span>
      </div>
    </div>
  );
}

function Curve({ progression }: { progression: ReturnType<typeof progressionFor> }) {
  const { points, stats } = progression;
  if (points.length === 0) {
    return <EmptyState title="Pas encore de données" message="Enregistre une série pour voir ta courbe." />;
  }
  const best = roundE1rm(stats.maxE1rm) ?? 0;
  const delta = stats.deltaE1rm === null ? null : roundE1rm(stats.deltaE1rm);
  const lastPoint = points[points.length - 1];
  const last = lastPoint ? roundE1rm(lastPoint.bestE1rm) : null;
  return (
    <div className={styles.curve}>
      <E1rmChart points={points} />
      <div className={styles.stats}>
        <StatTile label="1RM estimé max" value={formatWeight(best)} unit="kg" tone="accent" />
        <StatTile label="Dernière séance" value={last === null ? '—' : formatWeight(last)} unit="kg" />
        <StatTile
          label="Progression 1RM"
          value={delta === null ? '—' : `${delta >= 0 ? '+' : ''}${formatWeight(delta)}`}
          unit={delta === null ? undefined : 'kg'}
        />
        <StatTile label="Charge max" value={formatWeight(stats.maxWeight)} unit="kg" />
        <StatTile label="Séances" value={stats.sessions} />
        <StatTile label="Volume total" value={formatWeight(Math.round(stats.totalVolume))} unit="kg" />
      </div>
    </div>
  );
}
