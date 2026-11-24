import { useId, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCycleState, useExercises, usePerformances, useSaveCycleState, useSessions } from '@/data/queries';
import { cycleStatus, defaultCycleState } from '@/domain/cycles';
import { todayIso } from '@/domain/dates';
import type { CycleId, Session } from '@/domain/model';
import { startWorkout } from '@/domain/workout';
import { loadActiveWorkout, saveActiveWorkout, saveLastReport } from '@/features/workout';
import { Button, ConfirmDialog, EmptyState, IconButton, Segmented, Skeleton, useToast } from '@/ui';
import {
  durationHint,
  lastDoneLabel,
  lastDoneOn,
  revertSwitchesNow,
  seriesLabel,
  sessionsOfCycle,
  tabCaption,
  upcomingHint,
  withCycleWeeks,
} from './programModel';
import styles from './ProgramScreen.module.css';
import { SessionBuilder } from './SessionBuilder';

const CYCLES: CycleId[] = ['A', 'B'];
const VISIBLE_EXERCISES = 3;
const WEEK_OPTIONS = [
  { value: '2', label: '2 sem.' },
  { value: '3', label: '3 sem.' },
];

type BuilderState = { session: Session | null } | null;

export function ProgramScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const ids = useId();
  const today = todayIso();
  const cycleQuery = useCycleState();
  const saveCycle = useSaveCycleState();
  const sessionsQuery = useSessions();
  const exercisesQuery = useExercises();
  const perfsQuery = usePerformances();

  const cycleState = cycleQuery.data ?? defaultCycleState(today);
  const status = cycleStatus(cycleState, today);
  const [tab, setTab] = useState<CycleId | null>(null);
  const shownCycle = tab ?? status.current;
  const [builder, setBuilder] = useState<BuilderState>(null);
  const [pendingStart, setPendingStart] = useState<Session | null>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);

  const sessions = sessionsQuery.data ?? [];
  const list = sessionsOfCycle(sessions, shownCycle);
  const unassigned = sessionsOfCycle(sessions, null);
  const active = loadActiveWorkout();

  const saveWeeks = (weeks: 2 | 3) => {
    saveCycle.mutate(withCycleWeeks(cycleState, today, weeks), {
      onError: () => {
        toast.show('La durée du cycle n’a pas pu être enregistrée. Réessaie.', 'error');
      },
    });
  };

  const setWeeks = (value: string) => {
    const weeks = value === '3' ? 3 : 2;
    if (weeks === status.weeks) return;
    if (weeks === 2 && revertSwitchesNow(cycleState, today)) {
      setConfirmRevert(true);
      return;
    }
    saveWeeks(weeks);
  };

  /** Démarrage seulement avec la bibliothèque chargée (variantes par défaut correctes). */
  const canStart = exercisesQuery.isSuccess;

  const launch = (session: Session) => {
    if (!exercisesQuery.isSuccess) return;
    saveActiveWorkout(startWorkout(session, exercisesQuery.data, new Date()));
    // Le dernier compte rendu reste visible jusqu'au démarrage de la séance suivante.
    saveLastReport(null);
    void navigate('/workout');
  };

  const onStart = (session: Session) => {
    if (active?.sessionId === session.id) {
      void navigate('/workout');
      return;
    }
    if (active) {
      setPendingStart(session);
      return;
    }
    launch(session);
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: CycleId = shownCycle === 'A' ? 'B' : 'A';
    setTab(next);
    document.getElementById(`${ids}-tab-${next}`)?.focus();
  };

  const renderSession = (session: Session, code: string | null) => {
    const last = lastDoneLabel(lastDoneOn(perfsQuery.data ?? [], session.name), today);
    const isActive = active?.sessionId === session.id;
    const hidden = session.exercises.length - VISIBLE_EXERCISES;
    const title = code ? `${code} ${session.name}` : session.name;
    return (
      <li key={session.id} className={styles.session}>
        <button
          type="button"
          className={styles.sessionMain}
          aria-label={`${isActive ? 'Reprendre' : 'Démarrer'} ${title}`}
          disabled={session.exercises.length === 0 || (!canStart && !isActive)}
          onClick={() => { onStart(session); }}
        >
          <span className={styles.sessionHead}>
            <span className={styles.sessionTitle}>
              {code && <span className={styles.code}>{code}</span>} {session.name}
            </span>
            {isActive ? (
              <span className={styles.badge}>En cours</span>
            ) : (
              last && <span className={last.isToday ? styles.badge : styles.when}>{last.label}</span>
            )}
          </span>
          <span className={styles.exercises}>
            {session.exercises.length === 0 && <span className={styles.muted}>Aucun exercice</span>}
            {session.exercises.slice(0, VISIBLE_EXERCISES).map((e) => (
              <span key={e.exerciseId} className={styles.exercise}>
                <span>{e.name}</span>
                <span className={styles.muted}>{seriesLabel(e.series)}</span>
              </span>
            ))}
            {hidden > 0 && (
              <span className={styles.muted}>+{hidden} exercice{hidden > 1 ? 's' : ''}</span>
            )}
          </span>
        </button>
        <IconButton
          icon="edit"
          label={`Modifier ${title}`}
          className={styles.edit}
          onClick={() => { setBuilder({ session }); }}
        />
      </li>
    );
  };

  const isCurrentTab = shownCycle === status.current;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Programme</h1>
        <IconButton
          icon="plus"
          label="Ajouter une séance"
          className={styles.add}
          onClick={() => { setBuilder({ session: null }); }}
        />
      </header>

      <div role="tablist" aria-label="Cycle" className={styles.tabs}>
        {CYCLES.map((c) => {
          const selected = c === shownCycle;
          return (
            <button
              key={c}
              id={`${ids}-tab-${c}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${ids}-panel`}
              tabIndex={selected ? 0 : -1}
              className={[styles.tab, selected && styles.tabSelected].filter(Boolean).join(' ')}
              onClick={() => { setTab(c); }}
              onKeyDown={onTabKey}
            >
              <span className={styles.tabLetter}>{c}</span> {tabCaption(cycleState, today, c)}
            </button>
          );
        })}
      </div>

      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${shownCycle}`} className={styles.panel}>
        <div className={styles.duration}>
          {isCurrentTab ? (
            <>
              <div className={styles.durationRow}>
                <span className={styles.durationLabel}>Durée du cycle {shownCycle}</span>
                <Segmented
                  label={`Durée du cycle ${shownCycle}`}
                  options={WEEK_OPTIONS}
                  value={String(status.weeks)}
                  onChange={setWeeks}
                  className={styles.weeks}
                />
              </div>
              <p className={styles.hint}>{durationHint(cycleState, today)}</p>
            </>
          ) : (
            <p className={styles.hint}>{upcomingHint(cycleState, today, shownCycle)}</p>
          )}
        </div>

        {exercisesQuery.isError && (
          <div className={styles.errorBox} role="alert">
            <p>Impossible de charger les exercices : le démarrage d’une séance est indisponible.</p>
            <Button variant="secondary" onClick={() => { void exercisesQuery.refetch(); }}>
              Recharger les exercices
            </Button>
          </div>
        )}

        {sessionsQuery.isPending ? (
          <div className={styles.loading} role="status" aria-busy="true">
            <span className="visually-hidden">Chargement des séances…</span>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </div>
        ) : sessionsQuery.isError ? (
          <div className={styles.errorBox} role="alert">
            <p>Impossible de charger les séances.</p>
            <Button variant="secondary" onClick={() => { void sessionsQuery.refetch(); }}>
              Réessayer
            </Button>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="list"
            title={`Aucune séance dans le cycle ${shownCycle}`}
            message="Crée une séance et choisis ses exercices."
            action={
              <Button variant="accent" icon="plus" onClick={() => { setBuilder({ session: null }); }}>
                Créer une séance
              </Button>
            }
          />
        ) : (
          <ul className={styles.sessions} aria-label={`Séances du cycle ${shownCycle}`}>
            {list.map((s, i) => renderSession(s, `${shownCycle}${String(i + 1)}`))}
          </ul>
        )}

        {unassigned.length > 0 && (
          <section className={styles.unassigned} aria-labelledby={`${ids}-unassigned`}>
            <h2 id={`${ids}-unassigned`} className={styles.sectionTitle}>Sans cycle</h2>
            <p className={styles.hint}>Modifie ces séances pour les ranger dans le cycle A ou B.</p>
            <ul className={styles.sessions} aria-label="Séances sans cycle">
              {unassigned.map((s) => renderSession(s, null))}
            </ul>
          </section>
        )}
      </div>

      {builder && (
        <SessionBuilder
          session={builder.session}
          defaultCycle={shownCycle}
          onClose={() => { setBuilder(null); }}
        />
      )}

      <ConfirmDialog
        open={pendingStart !== null}
        title="Abandonner la séance en cours ?"
        message={`« ${active?.sessionName ?? ''} » est en cours. Démarrer « ${pendingStart?.name ?? ''} » l’abandonne : les séries saisies, pas encore enregistrées, seront perdues.`}
        confirmLabel="Abandonner et démarrer"
        danger
        onConfirm={() => {
          const session = pendingStart;
          setPendingStart(null);
          if (session) launch(session);
        }}
        onCancel={() => { setPendingStart(null); }}
      />

      <ConfirmDialog
        open={confirmRevert}
        title="Revenir à 2 semaines ?"
        message={`Revenir à 2 semaines fait basculer vers ${status.next} maintenant : le cycle ${status.current} a déjà duré 2 semaines.`}
        confirmLabel={`Basculer vers ${status.next}`}
        onConfirm={() => {
          setConfirmRevert(false);
          saveWeeks(2);
        }}
        onCancel={() => { setConfirmRevert(false); }}
      />
    </div>
  );
}
