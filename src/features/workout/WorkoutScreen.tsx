import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { Exercise, Performance, Variant } from '@/domain/model';
import { formatDecimal, formatWeight } from '@/domain/numbers';
import { logFromWorkout, upsertLog } from '@/domain/journal';
import { buildReport } from '@/domain/report';
import { variantLabel } from '@/domain/variants';
import {
  canValidate,
  toPerformanceInputs,
  type SerieEntry,
  type WorkoutExercise,
  type WorkoutState,
} from '@/domain/workout';
import { todayIso } from '@/domain/dates';
import { useAddPerformances, useExercises, usePerformances, useSessions } from '@/data/queries';
import { Button, cx, Field, Icon, IconButton, Pill, Sheet, Skeleton, useConfirm, useToast } from '@/ui';
import { AddExerciseSheet } from './AddExerciseSheet';
import { FeelingChips } from './FeelingChips';
import { isSameVariant, livePrFlags, prSignature, variantKeyOf, variantsOf } from './livePr';
import { RecordsSheet } from './RecordsSheet';
import { sessionCode } from './sessionCode';
import { loadActiveWorkout, loadLastReport, saveActiveWorkout, saveLastReport } from './storage';
import { JOURNAL_NOT_SYNCED_MESSAGE, useJournalSync } from './useJournalSync';
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
  const sessionsQuery = useSessions();
  const [exIdx, setExIdx] = useState(() => firstPendingIndex(state));
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const syncJournal = useJournalSync();

  const exercises = exercisesQuery.data ?? NO_EXERCISES;
  const perfs = perfsQuery.data ?? NO_PERFS;
  // Jamais de compte rendu ni d'envoi à partir de données de repli vides.
  const dataReady = perfsQuery.isSuccess && exercisesQuery.isSuccess;
  const dataError = perfsQuery.isError || exercisesQuery.isError;
  // Recalcul (buildReport) seulement quand les séries validées changent, pas à chaque frappe.
  const signature = prSignature(state);
  const prFlags = useMemo(
    () => (dataReady ? livePrFlags(JSON.parse(signature) as WorkoutState, perfs, exercises) : null),
    [dataReady, signature, perfs, exercises],
  );
  const nextExId = useId();
  const addSerieId = useId();
  const focusAfterLast = useRef(false);
  useEffect(() => {
    if (!focusAfterLast.current) return;
    focusAfterLast.current = false;
    // Le formulaire de série vient de disparaître : focus sur la suite logique.
    (document.getElementById(nextExId) ?? document.getElementById(addSerieId))?.focus();
  }, [state, nextExId, addSerieId]);
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
      const logId = crypto.randomUUID();
      saveLastReport({ ...buildReport(state, perfs, exercises), logId });
      const result = await addPerformances.mutateAsync(inputs);
      stopPersisting();
      saveActiveWorkout(null);
      if (result.queued) toast.show(QUEUED_MESSAGE, 'info');
      // Après les performances : un échec du journal ne bloque ni l'enregistrement ni le compte rendu.
      if (!(await syncJournal((j) => upsertLog(j, logFromWorkout(state, logId))))) {
        toast.show(JOURNAL_NOT_SYNCED_MESSAGE, 'error');
      }
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

  const abandon = async (): Promise<void> => {
    setOptionsOpen(false);
    const ok = await confirm({
      title: 'Abandonner la séance ?',
      message: 'Les séries saisies ne seront pas enregistrées. Ton historique ne change pas.',
      confirmLabel: 'Abandonner',
      danger: true,
    });
    if (!ok) return;
    stopPersisting();
    saveActiveWorkout(null);
    void navigate('/');
  };

  const removeExercise = async (): Promise<void> => {
    setOptionsOpen(false);
    if (!we) return;
    const done = we.series.filter((s) => s.validated).length;
    const ok = await confirm({
      title: 'Retirer l’exercice ?',
      message:
        done > 0
          ? `« ${we.name} » sort de cette séance : ${seriesWord(done)} validée${done > 1 ? 's' : ''} ne ${done > 1 ? 'seront' : 'sera'} pas enregistrée${done > 1 ? 's' : ''}.`
          : `« ${we.name} » sort de cette séance. Ton programme ne change pas.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    dispatch({ type: 'removeExercise', ex: current });
    setExIdx(Math.max(0, Math.min(current, total - 2)));
  };

  const today = todayIso();
  const code = sessionsQuery.data ? sessionCode(sessionsQuery.data, state.sessionId, state.cycle) : null;
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
        <span className={styles.session}>{code ? `${code} : ${state.sessionName}` : state.sessionName}</span>
        {total > 0 && (
          <>
            <span aria-hidden="true">{' · '}</span>
            <span className={styles.step}>{`Exercice ${String(current + 1)} sur ${String(total)}`}</span>
          </>
        )}
      </span>
      <IconButton
        icon="more"
        label="Options de la séance"
        onClick={() => {
          setOptionsOpen(true);
        }}
      />
      <Button
        className={styles.finish}
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

  const moodFirstLine = state.mood.split('\n').find((l) => l.trim() !== '')?.trim() ?? '';
  const moodSection = (
    <section className={styles.mood}>
      <button
        type="button"
        className={styles.moodToggle}
        aria-expanded={moodOpen}
        onClick={() => {
          setMoodOpen((o) => !o);
        }}
      >
        <span className={styles.moodLabel}>{moodFirstLine === '' ? 'Ajouter ton état général' : moodFirstLine}</span>
        <Icon name="chevron" size={16} />
      </button>
      {moodOpen && (
        <Field
          as="textarea"
          label="État général"
          rows={3}
          value={state.mood}
          onChange={(e) => {
            dispatch({ type: 'setMood', mood: e.target.value });
          }}
        />
      )}
    </section>
  );

  const optionsSheet = (
    <Sheet
      open={optionsOpen}
      onClose={() => {
        setOptionsOpen(false);
      }}
      title="Options de la séance"
    >
      <div className={styles.options}>
        <Field
          type="date"
          label="Date de la séance"
          hint="Pour saisir une séance faite un autre jour."
          value={state.date}
          max={today}
          onChange={(e) => {
            const date = e.target.value;
            // Jamais dans le futur ; un champ vidé garde la date actuelle.
            if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today) dispatch({ type: 'setDate', date });
          }}
        />
        {we && (
          <Button
            variant="secondary"
            icon="trash"
            fullWidth
            onClick={() => {
              void removeExercise();
            }}
          >
            {`Retirer ${we.name}`}
          </Button>
        )}
        <Button
          variant="danger"
          fullWidth
          onClick={() => {
            void abandon();
          }}
        >
          Abandonner la séance
        </Button>
      </div>
    </Sheet>
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
        {optionsSheet}
      </div>
    );
  }

  const exercise = exercisesQuery.isSuccess ? exercises.find((e) => e.id === we.exerciseId) : undefined;
  // Jamais de variantes devinées (chargement, erreur, exercice inconnu) : seulement celles de l'exercice.
  const variants = exercise ? variantsOf(exercise, we.exerciseId) : [];
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

      {moodSection}

      <h1 className={styles.title}>{name}</h1>

      <FeelingChips
        label={`Ressenti — ${name}`}
        value={we.feeling}
        onChange={(feeling) => {
          dispatch({ type: 'setFeeling', ex: current, feeling });
        }}
      />

      {coachNotes !== '' && (
        <div className={styles.coach}>
          <Icon name="info" size={16} className={styles.coachIcon} />
          <p>
            <strong>Coach :</strong> {coachNotes}
          </p>
        </div>
      )}

      {exercise ? (
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
      ) : exercisesQuery.isPending ? (
        <div className={styles.pills} aria-busy="true">
          <span className="visually-hidden">Chargement des variantes…</span>
          <Skeleton width={96} height={44} />
          <Skeleton width={72} height={44} />
        </div>
      ) : (
        exercisesQuery.isSuccess && (
          <p className={cx(styles.muted, styles.pills)}>
            Exercice introuvable dans ta bibliothèque : variantes et records indisponibles.
          </p>
        )
      )}

      <DoneSeries
        we={we}
        prs={prs}
        variants={variants}
        onEdit={(i) => {
          dispatch({ type: 'unlock', ex: current, serie: i });
        }}
      />

      {serie ? (
        <SerieForm
          serie={serie}
          n={serieIdx + 1}
          recordsAvailable={exercise !== undefined}
          onOpenRecords={() => {
            setRecordsOpen(true);
          }}
          onRemove={
            we.series.length > 1
              ? () => {
                  dispatch({ type: 'removeSerie', ex: current, serie: serieIdx });
                }
              : null
          }
          onChange={(field, value) => {
            dispatch({ type: 'setField', ex: current, serie: serieIdx, field, value });
          }}
          onRpe={(value) => {
            dispatch({ type: 'setField', ex: current, serie: serieIdx, field: 'rpe', value });
          }}
          onValidate={() => {
            focusAfterLast.current = we.series.every((s, i) => i === serieIdx || s.validated);
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
            id={addSerieId}
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
            id={nextExId}
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
        open={recordsOpen && exercise !== undefined}
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
      {optionsSheet}
    </div>
  );
}

interface DoneSeriesProps {
  we: WorkoutExercise;
  prs: boolean[];
  variants: Variant[];
  /** Rouvre la série (déverrouillage) pour la corriger. */
  onEdit: (serie: number) => void;
}

function DoneSeries({ we, prs, variants, onEdit }: DoneSeriesProps) {
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
                kg · RPE {formatDecimal(s.rpe)}
                {multi && ` · ${variantLabel(v?.name ?? s.variantKey)}`}
              </span>
            </span>
            <span className={styles.doneActions}>
              {prs[i] && <span className={styles.prBadge}>PR</span>}
              <button
                type="button"
                className={styles.editBtn}
                aria-label={`Modifier la série ${String(i + 1)}`}
                onClick={() => {
                  onEdit(i);
                }}
              >
                Modifier
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface SerieFormProps {
  serie: SerieEntry;
  n: number;
  /** « Mes records » indisponible tant que l'exercice (et ses variantes) n'est pas connu. */
  recordsAvailable: boolean;
  onOpenRecords: () => void;
  /** Supprime cette série à faire ; `null` si c'est la dernière de l'exercice. */
  onRemove: (() => void) | null;
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

function SerieForm({
  serie,
  n,
  recordsAvailable,
  onOpenRecords,
  onRemove,
  onChange,
  onRpe,
  onValidate,
  stopLabel,
  onStop,
}: SerieFormProps) {
  const repsRef = useRef<HTMLInputElement>(null);
  return (
    <section className={styles.form} aria-labelledby="serie-title">
      <div className={styles.serieHead}>
        <h2 id="serie-title" className={styles.serieTitle}>
          Série {n}
        </h2>
        <span className={styles.serieActions}>
          {onRemove && <IconButton icon="trash" label={`Supprimer la série ${String(n)}`} onClick={onRemove} />}
          <button type="button" className={styles.recordsBtn} onClick={onOpenRecords} disabled={!recordsAvailable}>
            <Icon name="table" size={16} />
            Mes records
          </button>
        </span>
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
