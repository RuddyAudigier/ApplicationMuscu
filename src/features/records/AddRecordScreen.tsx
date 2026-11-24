import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { performanceTimestamp, todayIso } from '@/domain/dates';
import type { Exercise, IsoDate, PerformanceInput, Variant } from '@/domain/model';
import { parseReps, parseRpe, parseWeight } from '@/domain/numbers';
import { defaultCycleState } from '@/domain/cycles';
import { classify, findPreviousBest } from '@/domain/records';
import { MANUAL_SESSION, sessionNameForDay } from '@/domain/sessions';
import { getDefaultVariant, variantLabel, variantMatches } from '@/domain/variants';
import { useAddPerformances, useCycleState, useExercises, useHistoryIndex, usePerformances, useSessions } from '@/data/queries';
import { Button, Icon, IconButton, Pill, Skeleton, useToast } from '@/ui';
import { ExercisePicker } from './ExercisePicker';
import { cx, longDateFr, nextDayIso, prMessage, yesterdayIso } from './format';
import styles from './Records.module.css';

type DateChoice = 'today' | 'yesterday' | 'other';

function initialVariant(exercise: Exercise | null, name: string | null): Variant | null {
  if (!exercise) return null;
  const found = name === null ? undefined : exercise.variants.find((v) => variantMatches(v, { variantId: null, variantName: name }));
  return found ?? getDefaultVariant(exercise.variants);
}

export function AddRecordScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const exercisesQuery = useExercises();
  const perfsQuery = usePerformances();
  const sessionsQuery = useSessions();
  const cycleQuery = useCycleState();
  const history = useHistoryIndex();
  /** Sans historique chargé, aucune comparaison n'est fiable : pas d'encadré, pas d'enregistrement. */
  const historyReady = perfsQuery.isSuccess;
  const addPerformances = useAddPerformances();

  const exercises = useMemo(() => exercisesQuery.data ?? [], [exercisesQuery.data]);
  const [exerciseId, setExerciseId] = useState<string | null>(params.get('exerciseId'));
  const [variantName, setVariantName] = useState<string | null>(params.get('variant'));
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [choice, setChoice] = useState<DateChoice>('today');
  const today = todayIso();
  const [otherDate, setOtherDate] = useState<IsoDate>(yesterdayIso(today));
  const [submitted, setSubmitted] = useState(false);
  /** Instant d'ouverture : référence « maintenant » pour un PR daté d'aujourd'hui. */
  const [openedAt] = useState(() => Date.now());

  const exercise = exercises.find((e) => e.id === exerciseId) ?? exercises[0] ?? null;
  const variant = initialVariant(exercise, variantName);

  const date: IsoDate = choice === 'today' ? today : choice === 'yesterday' ? yesterdayIso(today) : otherDate;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;

  const repsN = parseReps(reps);
  const weightN = parseWeight(weight);
  const rpeN = rpe.trim() === '' ? null : parseRpe(rpe);
  const repsError = repsN === null || repsN < 1 ? 'Reps : nombre entier ≥ 1.' : null;
  const weightError = weightN === null ? 'Kg : nombre ≥ 0.' : null;
  const rpeError = rpe.trim() !== '' && rpeN === null ? 'RPE : entier de 6 à 10.' : null;
  const dateError = dateValid ? null : 'Date invalide ou dans le futur.';
  const valid = !repsError && !weightError && !rpeError && !dateError && exercise !== null && variant !== null;

  /** Séance de rattachement : séance prévue du cycle ce jour-là si faite, sinon la plus fréquente. */
  const session = useMemo(() => {
    if (!perfsQuery.data || !dateValid) return MANUAL_SESSION;
    const plan = sessionsQuery.data
      ? { sessions: sessionsQuery.data, cycleState: cycleQuery.data ?? defaultCycleState(today) }
      : undefined;
    return sessionNameForDay(perfsQuery.data, date, plan);
  }, [perfsQuery.data, sessionsQuery.data, cycleQuery.data, date, dateValid, today]);

  const preview = useMemo(() => {
    if (!historyReady || !exercise || !variant || repsN === null || repsN < 1 || weightN === null || !dateValid) return null;
    const perf = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      variantId: variant.id,
      variantName: variant.name,
      reps: repsN,
      weight: weightN,
      performanceDate: date,
      createdAt: null,
    };
    // Aujourd'hui : l'ouverture de l'écran. Autre jour : toute la journée (minuit suivant, exclu),
    // pour qu'une série déjà faite ce jour-là ressaisie ne passe jamais pour un PR.
    const atTimestamp =
      date === today ? openedAt : (performanceTimestamp({ performanceDate: nextDayIso(date), createdAt: null }) ?? openedAt);
    const ref = findPreviousBest(history, exercise.id, perf, { atTimestamp });
    return { message: prMessage({ reps: repsN, weight: weightN }, ref), isPr: classify({ reps: repsN, weight: weightN }, ref).improvementStatus === 'improved' };
  }, [historyReady, exercise, variant, repsN, weightN, date, dateValid, history, today, openedAt]);

  const backHref = exercise
    ? `/records/${encodeURIComponent(exercise.id)}${variant && !variant.isDefault ? `?variant=${encodeURIComponent(variant.name)}` : ''}`
    : '/records';

  const save = async () => {
    setSubmitted(true);
    if (!valid || !historyReady || repsN === null || weightN === null) return;
    const input: PerformanceInput = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sessionName: session,
      reps: repsN,
      weight: weightN,
      rpe: rpeN,
      variantId: variant.id,
      variantName: variant.name,
      serieNumber: 1,
      performanceDate: date,
    };
    try {
      const result = await addPerformances.mutateAsync([input]);
      if (result.queued) {
        toast.show('Hors ligne : performance mise en attente, elle sera envoyée au retour du réseau.', 'info');
      } else {
        toast.show(preview?.isPr ? 'PR enregistré.' : 'Performance enregistrée.', 'success');
      }
      void navigate(backHref);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.show(`Échec de l'enregistrement, rien n'a été sauvegardé : ${message}`, 'error');
    }
  };

  const show = (error: string | null) => (submitted ? error : null);

  return (
    <div className={styles.addScreen}>
      <div className={styles.addTop}>
        <IconButton
          icon="x"
          label="Fermer"
          variant="surface"
          onClick={() => {
            void navigate(backHref);
          }}
        />
        <span className={styles.addContext}>Hors séance</span>
        <span className={styles.addSpacer} />
      </div>

      <h1 className={styles.addTitle}>Ajouter un PR</h1>

      {exercisesQuery.isPending && <Skeleton height={200} />}
      {exercisesQuery.isError && (
        <p role="alert" className={styles.error}>
          Impossible de charger les exercices. Vérifie ta connexion puis réessaie.
        </p>
      )}
      {exercisesQuery.isSuccess && !exercise && <p className={styles.error}>Aucun exercice : crée d'abord un exercice.</p>}

      {exercise && variant && (
        <form
          className={styles.addForm}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <ExercisePicker
            look="card"
            exercises={exercises}
            selected={exercise}
            onSelect={(id) => {
              setExerciseId(id);
              setVariantName(null);
            }}
          />

          <div role="radiogroup" aria-label="Variante" className={styles.variantsWrap}>
            {exercise.variants.map((v) => (
              <Pill
                key={v.id ?? v.name}
                selected={v.id === variant.id && v.name === variant.name}
                onSelect={() => {
                  setVariantName(v.name);
                }}
              >
                {variantLabel(v.name)}
              </Pill>
            ))}
          </div>

          <div className={styles.inputs}>
            <BigInput label="Reps" mode="numeric" value={reps} onChange={setReps} error={show(repsError)} />
            <BigInput label="Kg" mode="decimal" value={weight} onChange={setWeight} error={show(weightError)} />
            <BigInput label="RPE" mode="numeric" value={rpe} onChange={setRpe} error={rpeError} placeholder="—" />
          </div>
          {[show(repsError), show(weightError), rpeError].filter(Boolean).map((err) => (
            <p key={err} className={styles.fieldError}>
              {err}
            </p>
          ))}

          <span id="pr-date-label" className={styles.dateLabel}>
            Date du PR
          </span>
          <div role="radiogroup" aria-labelledby="pr-date-label" className={styles.dateChoices}>
            <Pill selected={choice === 'today'} onSelect={() => { setChoice('today'); }}>
              Aujourd'hui
            </Pill>
            <Pill selected={choice === 'yesterday'} onSelect={() => { setChoice('yesterday'); }}>
              Hier
            </Pill>
            <Pill selected={choice === 'other'} onSelect={() => { setChoice('other'); }}>
              <span className={styles.otherLabel}>
                <Icon name="table" size={14} />
                Autre
              </span>
            </Pill>
          </div>
          {choice === 'other' && (
            <label className={styles.otherDate}>
              <span className={styles.dateLabel}>Choisir la date</span>
              <input
                type="date"
                max={today}
                value={otherDate}
                aria-invalid={dateError ? true : undefined}
                onChange={(e) => {
                  setOtherDate(e.target.value);
                }}
                className={styles.dateInput}
              />
            </label>
          )}
          <span className={styles.dateLine}>
            {dateValid ? longDateFr(date) : dateError}
            {dateValid && session !== MANUAL_SESSION && (
              <>
                {' · rattaché à '}
                <strong className={styles.dateSession}>{session}</strong>
              </>
            )}
          </span>

          {perfsQuery.isPending && <p className={styles.historyState}>Chargement de ton historique…</p>}
          {perfsQuery.isError && (
            <div className={styles.historyError}>
              <p role="alert">Impossible de charger ton historique : pas de comparaison ni d'enregistrement possibles.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  void perfsQuery.refetch();
                }}
              >
                Réessayer
              </Button>
            </div>
          )}

          {preview && (
            <div
              data-testid="pr-box"
              className={cx(styles.prBox, preview.message.tone !== 'pr' && styles.prBoxMuted)}
              role="status"
              aria-live="polite"
            >
              <span className={cx(styles.prBadge, preview.message.tone !== 'pr' && styles.prBadgeMuted)}>
                {preview.message.badge}
              </span>
              <span className={styles.prText}>
                {preview.message.lead}
                {preview.message.strong && <strong>{preview.message.strong}</strong>}
                {preview.message.tail}
              </span>
            </div>
          )}

          <div className={styles.grow} />

          <Button
            type="submit"
            variant="accent"
            size="lg"
            fullWidth
            loading={addPerformances.isPending}
            disabled={!historyReady}
          >
            Enregistrer le PR
          </Button>
        </form>
      )}
    </div>
  );
}

interface BigInputProps {
  label: string;
  mode: 'numeric' | 'decimal';
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  placeholder?: string;
}

/** Grand champ de la maquette (libellé en haut, valeur Space Grotesk 28 px). */
function BigInput({ label, mode, value, onChange, error, placeholder }: BigInputProps) {
  return (
    <label className={cx(styles.bigField, error && styles.bigFieldError)}>
      <span className={styles.bigLabel}>{label}</span>
      <input
        type="text"
        inputMode={mode}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={styles.bigInput}
      />
    </label>
  );
}
