import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { Exercise, Performance, Variant } from '@/domain/model';
import { formatWeight } from '@/domain/numbers';
import { buildReport } from '@/domain/report';
import { variantLabel } from '@/domain/variants';
import {
  canValidate,
  toPerformanceInputs,
  type SerieEntry,
  type WorkoutExercise,
  type WorkoutState,
} from '@/domain/workout';
import { useAddPerformances, useExercises, usePerformances } from '@/data/queries';
import { Button, Icon, IconButton, Pill, useConfirm, useToast } from '@/ui';
import { AddExerciseSheet } from './AddExerciseSheet';
import { cx } from './cx';
import { isSameVariant, livePrFlags, variantKeyOf, variantsOf } from './livePr';
import { RecordsSheet } from './RecordsSheet';
import { loadActiveWorkout, loadLastReport, saveActiveWorkout, saveLastReport } from './storage';
import { WorkoutProvider, useWorkout } from './WorkoutContext';
import styles from './WorkoutScreen.module.css';

const RPES = [6, 7, 8, 9, 10] as const;
const NO_PERFS: Performance[] = [];
const NO_EXERCISES: Exercise[] = [];

const QUEUED_MESSAGE =
  'Connexion instable… Ta séance est gardée sur cet appareil et sera envoyée au retour du réseau.';
const DATA_ERROR_MESSAGE =
  'Impossible de charger tes exercices ou ton historique : la séance ne peut pas encore être terminée.';
const DATA_NOT_READY_MESSAGE = 'Données pas encore chargées : réessaie dans un instant.';
const ERROR_MESSAGE =
  'Enregistrement impossible. Ta séance est conservée sur cet appareil : réessaie « Terminer ».';

/** Premier exercice qui a encore une série à faire (sinon le dernier). */
function firstPendingIndex(state: WorkoutState): number {
  const i = state.exercises.findIndex((e) => !e.stoppedEarly && e.series.some((s) => !s.validated));
  return i >= 0 ? i : Math.max(0, state.exercises.length - 1);
}

const seriesWord = (n: number): string => `${String(n)} série${n > 1 ? 's' : ''}`;

/** Route `/workout` : sans séance en cours sauvegardée, retour à l'accueil. */
export function WorkoutScreen() {
  const [initial] = useState(loadActiveWorkout);
  if (!initial) return <Navigate to="/" replace />;
  return (
    <WorkoutProvider initial={initial}>
      <WorkoutView />
    </WorkoutProvider>
  );
}

function WorkoutView() {
  const { state, dispatch, stopPersisting } = useWorkout();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const exercisesQuery = useExercises();
  const perfsQuery = usePerformances();
  const addPerformances = useAddPerformances();
  const [exIdx, setExIdx] = useState(() => firstPendingIndex(state));
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const exercises = exercisesQuery.data ?? NO_EXERCISES;
  const perfs = perfsQuery.data ?? NO_PERFS;
  // Jamais de compte rendu ni d'envoi à partir de données de repli vides.
  const dataReady = perfsQuery.isSuccess && exercisesQuery.isSuccess;
  const dataError = perfsQuery.isError || exercisesQuery.isError;
  const prFlags = useMemo(
    () => (dataReady ? livePrFlags(state, perfs, exercises) : null),
    [dataReady, state, perfs, exercises],
  );
  const total = state.exercises.length;
  const current = Math.min(exIdx, Math.max(0, total - 1));
  const we = state.exercises[current];

  const retryData = (): void => {
    if (perfsQuery.isError) void perfsQuery.refetch();
    if (exercisesQuery.isError) void exercisesQuery.refetch();
  };

  const finish = async (): Promise<void> => {
    if (!dataReady) {
      toast.show(dataError ? DATA_ERROR_MESSAGE : DATA_NOT_READY_MESSAGE, 'error');
      return;
    }
    const inputs = toPerformanceInputs(state, exercises);
    if (inputs.length === 0) {
      const ok = await confirm({
        title: 'Quitter la séance ?',
        message: 'Aucune série validée : rien ne sera enregistré.',
        confirmLabel: 'Quitter',
        danger: true,
      });
      if (!ok) return;
      stopPersisting();
      saveActiveWorkout(null);
      void navigate('/');
      return;
    }
    const left = state.exercises.reduce(
      (n, e) => n + (e.stoppedEarly ? 0 : e.series.filter((s) => !s.validated).length),
      0,
    );
    if (left > 0) {
      const ok = await confirm({
        title: 'Terminer la séance ?',
        message: `${seriesWord(left)} non validée${left > 1 ? 's' : ''} ne ${left > 1 ? 'seront' : 'sera'} pas enregistrée${left > 1 ? 's' : ''}.`,
        confirmLabel: 'Terminer',
      });
      if (!ok) return;
    }
    setFinishing(true);
    const previousReport = loadLastReport();
    try {
      // Historique lu AVANT l'envoi : il ne contient pas encore les séries de cette séance.
      saveLastReport(buildReport(state, perfs, exercises));
      const result = await addPerformances.mutateAsync(inputs);
      stopPersisting();
      saveActiveWorkout(null);
      if (result.queued) toast.show(QUEUED_MESSAGE, 'info');
      void navigate('/report');
    } catch (e) {
      console.error('[workout] Enregistrement de la séance impossible :', e);
      // Rien n'est effacé : la séance reste en mémoire et en localStorage ; pas de compte rendu
      // d'une séance non enregistrée.
      saveLastReport(previousReport);
      toast.show(ERROR_MESSAGE, 'error');
      setFinishing(false);
    }
  };

  const header = (
    <header className={styles.header}>
      <IconButton
        icon="back"
        label="Retour au programme"
        variant="surface"
        onClick={() => {
          void navigate('/program');
        }}
      />
      <span className={styles.progress}>
        <span className={styles.session}>{state.sessionName}</span>
        {total > 0 && ` · exercice ${String(current + 1)} sur ${String(total)}`}
      </span>
      <Button
        variant="secondary"
        loading={finishing}
        disabled={!dataReady}
        onClick={() => {
          void finish();
        }}
      >
        Terminer
      </Button>
    </header>
  );
  const dataBanner = dataError && (
    <div role="alert" className={styles.dataError}>
      <p>{DATA_ERROR_MESSAGE}</p>
      <Button variant="secondary" onClick={retryData}>
        Réessayer
      </Button>
    </div>
  );

  const bonusSheet = (
    <AddExerciseSheet
      open={bonusOpen}
      onClose={() => {
        setBonusOpen(false);
      }}
      exercises={exercises}
      onPick={(exercise) => {
        dispatch({ type: 'addExercise', exercise });
        setExIdx(total);
        setBonusOpen(false);
      }}
    />
  );

  if (!we) {
    return (
      <div className={styles.screen}>
        {header}
        {dataBanner}
        <p className={styles.muted}>Aucun exercice dans cette séance.</p>
        <Button
          variant="secondary"
          icon="plus"
          onClick={() => {
            setBonusOpen(true);
          }}
        >
          Ajouter un exercice
        </Button>
        {bonusSheet}
      </div>
    );
  }

  const exercise = exercises.find((e) => e.id === we.exerciseId);
  const variants = variantsOf(exercise, we.exerciseId);
  const prs = prFlags?.[current] ?? [];
  const serieIdx = we.series.findIndex((s) => !s.validated);
  const serie = serieIdx >= 0 ? we.series[serieIdx] : undefined;
  const doneCount = we.series.filter((s) => s.validated).length;
  const lastSerie = we.series[we.series.length - 1];
  const activeKey = serie?.variantKey ?? lastSerie?.variantKey ?? (variants[0] ? variantKeyOf(variants[0]) : '');
  const coachNotes = exercise?.coachNotes.trim() ?? '';

  /** Change la variante de la série en cours ; la cible (liée à une variante) est effacée. */
  const switchVariant = (v: Variant): void => {
    if (!serie || isSameVariant(v, serie.variantKey)) return;
    dispatch({ type: 'setTarget', ex: current, serie: serieIdx, target: null });
    dispatch({ type: 'setField', ex: current, serie: serieIdx, field: 'variantKey', value: variantKeyOf(v) });
  };

  const stopExercise = async (): Promise<void> => {
    if (serie && (serie.reps.trim() !== '' || serie.kg.trim() !== '')) {
      const ok = await confirm({
        title: 'Arrêter l’exercice ?',
        message: `La série ${String(serieIdx + 1)} est saisie mais pas validée : elle ne sera pas enregistrée.`,
        confirmLabel: 'Arrêter',
      });
      if (!ok) return;
    }
    dispatch({ type: 'stopExercise', ex: current });
    if (current < total - 1) setExIdx(current + 1);
  };
  const name = exercise?.name ?? we.name;

  return (
    <div className={styles.screen}>
      {header}
      {dataBanner}

      <h1 className={styles.title}>{name}</h1>

      {coachNotes !== '' && (
        <div className={styles.coach}>
          <Icon name="info" size={16} className={styles.coachIcon} />
          <p>
            <strong>Coach :</strong> {coachNotes}
          </p>
        </div>
      )}

      <div role="radiogroup" aria-label="Variante" className={styles.pills}>
        {variants.map((v) => (
          <Pill
            key={variantKeyOf(v)}
            selected={isSameVariant(v, activeKey)}
            disabled={!serie}
            onSelect={() => {
              switchVariant(v);
            }}
          >
            {variantLabel(v.name)}
          </Pill>
        ))}
      </div>

      <DoneSeries we={we} prs={prs} variants={variants} />

      {serie ? (
        <SerieForm
          serie={serie}
          n={serieIdx + 1}
          onOpenRecords={() => {
            setRecordsOpen(true);
          }}
          onChange={(field, value) => {
            dispatch({ type: 'setField', ex: current, serie: serieIdx, field, value });
          }}
          onRpe={(value) => {
            dispatch({ type: 'setField', ex: current, serie: serieIdx, field: 'rpe', value });
          }}
          onValidate={() => {
            dispatch({ type: 'validate', ex: current, serie: serieIdx, at: new Date().toISOString() });
          }}
          stopLabel={doneCount > 0 ? `Fatigué ? Arrêter à ${seriesWord(doneCount)}` : null}
          onStop={() => {
            void stopExercise();
          }}
        />
      ) : (
        <div className={styles.doneBox}>
          <p className={styles.doneText}>
            <Icon name="check" size={18} /> Exercice terminé · {seriesWord(doneCount)}
            {we.stoppedEarly && ' · fatigué'}
          </p>
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => {
              dispatch({ type: 'addSerie', ex: current });
            }}
          >
            Ajouter une série
          </Button>
        </div>
      )}

      <div role="group" className={styles.exNav} aria-label="Exercices de la séance">
        <Button
          variant="ghost"
          disabled={current === 0}
          onClick={() => {
            setExIdx(current - 1);
          }}
        >
          ‹ Exercice précédent
        </Button>
        {current < total - 1 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setExIdx(current + 1);
            }}
          >
            Exercice suivant ›
          </Button>
        ) : (
          <Button
            variant="ghost"
            icon="plus"
            onClick={() => {
              setBonusOpen(true);
            }}
          >
            Exercice bonus
          </Button>
        )}
      </div>

      <RecordsSheet
        open={recordsOpen}
        onClose={() => {
          setRecordsOpen(false);
        }}
        exerciseId={we.exerciseId}
        exerciseName={name}
        variants={variants}
        variantKey={activeKey}
        targetReps={serie?.target?.reps ?? null}
        perfs={perfs}
        onSelectVariant={switchVariant}
        onPick={(row, variant) => {
          if (serieIdx >= 0) {
            dispatch({
              type: 'setTarget',
              ex: current,
              serie: serieIdx,
              target: { reps: row.reps, weight: row.weight, variantKey: variantKeyOf(variant) },
            });
          }
          setRecordsOpen(false);
        }}
      />
      {bonusSheet}
    </div>
  );
}

function DoneSeries({ we, prs, variants }: { we: WorkoutExercise; prs: boolean[]; variants: Variant[] }) {
  const done = we.series.map((s, i) => ({ s, i })).filter(({ s }) => s.validated);
  if (done.length === 0) return null;
  const multi = variants.length > 1;
  return (
    <ul className={styles.done} aria-label="Séries faites">
      {done.map(({ s, i }) => {
        const v = variants.find((x) => isSameVariant(x, s.variantKey));
        return (
          <li key={i} className={styles.doneRow}>
            <span className={styles.doneN}>S{i + 1}</span>
            <span className={styles.doneValue}>
              {s.reps} × {formatWeight(s.kg)}{' '}
              <span className={styles.doneMeta}>
                kg · RPE {s.rpe}
                {multi && ` · ${variantLabel(v?.name ?? s.variantKey)}`}
              </span>
            </span>
            {prs[i] && <span className={styles.prBadge}>PR</span>}
          </li>
        );
      })}
    </ul>
  );
}

interface SerieFormProps {
  serie: SerieEntry;
  n: number;
  onOpenRecords: () => void;
  onChange: (field: 'reps' | 'kg', value: string) => void;
  onRpe: (value: number) => void;
  onValidate: () => void;
  stopLabel: string | null;
  onStop: () => void;
}

function targetText(serie: SerieEntry): string {
  const { target } = serie;
  if (!target) return 'Pas encore de cible · ouvre « Mes records »';
  if (target.weight === null) return `Cible : premier record à ${String(target.reps)} reps`;
  return `Cible : battre ${String(target.reps)} × ${formatWeight(target.weight)} kg`;
}

function SerieForm({ serie, n, onOpenRecords, onChange, onRpe, onValidate, stopLabel, onStop }: SerieFormProps) {
  const repsRef = useRef<HTMLInputElement>(null);
  return (
    <section className={styles.form} aria-labelledby="serie-title">
      <div className={styles.serieHead}>
        <h2 id="serie-title" className={styles.serieTitle}>
          Série {n}
        </h2>
        <button type="button" className={styles.recordsBtn} onClick={onOpenRecords}>
          <Icon name="table" size={16} />
          Mes records
        </button>
      </div>

      <p className={cx(styles.target, serie.target && styles.targetOn)}>
        <span className={styles.dot} aria-hidden="true" />
        {targetText(serie)}
      </p>

      <div className={styles.inputs}>
        <label className={styles.inputBox}>
          <span className={styles.inputLabel}>Reps</span>
          <input
            type="text"
            ref={repsRef}
            inputMode="numeric"
            placeholder="0"
            value={serie.reps}
            onChange={(e) => {
              onChange('reps', e.target.value);
            }}
            className={styles.input}
          />
        </label>
        <label className={styles.inputBox}>
          <span className={styles.inputLabel}>Poids (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={serie.kg}
            onChange={(e) => {
              onChange('kg', e.target.value);
            }}
            className={styles.input}
          />
        </label>
      </div>

      <span className={styles.inputLabel} id="rpe-label">
        RPE
      </span>
      <div role="radiogroup" aria-labelledby="rpe-label" className={styles.rpes}>
        {RPES.map((r) => (
          <Pill
            key={r}
            selected={serie.rpe === r}
            onSelect={() => {
              onRpe(r);
            }}
          >
            {r}
          </Pill>
        ))}
      </div>

      <div className={styles.spacer} />

      <Button
        variant="accent"
        icon="check"
        fullWidth
        disabled={!canValidate(serie)}
        onClick={() => {
          onValidate();
          // Série suivante : la saisie reprend directement sur les reps.
          repsRef.current?.focus();
        }}
      >
        Valider la série
      </Button>
      {stopLabel && (
        <button type="button" className={styles.stop} onClick={onStop}>
          {stopLabel}
        </button>
      )}
    </section>
  );
}
