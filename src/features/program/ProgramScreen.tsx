import { useId, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCycleState, useExercises, useJournal, usePerformances, useSaveCycleState, useSessions } from '@/data/queries';
import { cancelPostpone, canCancelPostpone, canSetCycleLength, cycleStatus, defaultCycleState, postponeCycle, setCycleLength } from '@/domain/cycles';
import { todayIso } from '@/domain/dates';
import type { CycleId, CycleState, Session } from '@/domain/model';
import { warmupsForSession, type Form } from '@/domain/journal';
import { startWorkout } from '@/domain/workout';
import {
  FormSheet,
  isJournalSettled,
  loadActiveWorkout,
  saveActiveWorkout,
  saveLastReport,
  usePendingReportSync,
} from '@/features/workout';
import { Button, ConfirmDialog, cx, EmptyState, ErrorNotice, Field, IconButton, PageHeader, SectionTitle, Skeleton, useToast } from '@/ui';
import {
  LENGTH_OPTIONS,
  lastDoneLabel,
  lastDoneOn,
  nextCycleLine,
  seriesLabel,
  sessionCode,
  sessionsOfCycle,
  tabCaption,
  upcomingHint,
} from './programModel';
import styles from './ProgramScreen.module.css';
import { SessionBuilder } from './SessionBuilder';
import { WarmupSection } from './WarmupSection';
import { WeekPlanSection } from './WeekPlanSection';

const CYCLES: CycleId[] = ['A', 'B'];
const VISIBLE_EXERCISES = 3;

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
  const journalQuery = useJournal();

  // Défaut seulement si la lecture a réussi sans état enregistré ; jamais en attente ou en erreur (D8).
  const cycleState = cycleQuery.isSuccess ? (cycleQuery.data ?? defaultCycleState(today)) : null;
  const status = cycleState ? cycleStatus(cycleState, today) : null;
  const [tab, setTab] = useState<CycleId | null>(null);
  const shownCycle: CycleId = tab ?? status?.current ?? 'A';
  /** Aucun onglet choisi et cycle inconnu : la liste n'est pas affichée (pas de cycle deviné). */
  const cycleUnknown = tab === null && status === null;
  const [builder, setBuilder] = useState<BuilderState>(null);
  const [pendingStart, setPendingStart] = useState<Session | null>(null);

  const sessions = sessionsQuery.data ?? [];
  const list = sessionsOfCycle(sessions, shownCycle);
  const unassigned = sessionsOfCycle(sessions, null);
  const active = loadActiveWorkout();

  const saveState = (next: CycleState) => {
    saveCycle.mutate(next, {
      onError: () => {
        toast.show('Le cycle n’a pas pu être enregistré. Réessaie.', 'error');
      },
    });
  };

  const setLength = (value: string) => {
    if (!cycleState) return;
    const days = Number(value);
    if (days === cycleState.lengthDays) return;
    saveState(setCycleLength(cycleState, today, days));
  };

  /** Démarrage seulement avec la bibliothèque chargée (variantes par défaut correctes). */
  const canStart = exercisesQuery.isSuccess && isJournalSettled(journalQuery);
  const pushPendingReport = usePendingReportSync();

  // Séance en attente du choix de la forme du jour.
  const [formFor, setFormFor] = useState<Session | null>(null);

  const launch = (session: Session, form: Form) => {
    if (!exercisesQuery.isSuccess || !canStart) return;
    saveActiveWorkout(
      startWorkout(session, exercisesQuery.data, new Date(), form, warmupsForSession(journalQuery.data, session.id)),
    );
    // Le dernier compte rendu reste visible jusqu'au démarrage de la séance suivante : on le rattrape d'abord.
    pushPendingReport();
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
    setFormFor(session);
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
    const title = code ? `${code} : ${session.name}` : session.name;
    return (
      <li key={session.id} className={styles.session}>
        <button
          type="button"
          className={styles.sessionMain}
          disabled={session.exercises.length === 0 || (!canStart && !isActive)}
          onClick={() => { onStart(session); }}
        >
          {/* Nom accessible = texte visible (WCAG 2.5.3) ; les espaces explicites séparent les mots
              (conteneurs flex : ils ne s'affichent pas). */}
          <span className="visually-hidden">{isActive ? 'Reprendre' : 'Démarrer'}</span>{' '}
          <span className={styles.sessionHead}>
            <span className={styles.sessionTitle}>
              {code && <span className={styles.code}>{code} :</span>} {session.name}
            </span>{' '}
            {isActive ? (
              <span className={styles.badge}>En cours</span>
            ) : (
              last && <span className={last.isToday ? styles.badge : styles.when}>{last.label}</span>
            )}
          </span>{' '}
          <span className={styles.exercises}>
            {session.exercises.length === 0 && <span className={styles.muted}>Aucun exercice</span>}
            {session.exercises.slice(0, VISIBLE_EXERCISES).map((e) => (
              <span key={e.exerciseId} className={styles.exercise}>
                <span>{e.name}</span>{' '}
                <span className={styles.muted}>{seriesLabel(e.series)}</span>{' '}
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

  const isCurrentTab = shownCycle === status?.current;

  const duration = !cycleState || !status ? (
    cycleQuery.isError ? (
      <ErrorNotice
        message="Impossible de charger ton cycle A/B. Vérifie ta connexion puis réessaie."
        onRetry={() => { void cycleQuery.refetch(); }}
      />
    ) : (
      <div className={styles.loading} aria-busy="true">
        <span className="visually-hidden">Chargement du cycle…</span>
        <Skeleton height={18} />
      </div>
    )
  ) : isCurrentTab ? (
    <>
      <Field
        as="select"
        label="Durée des cycles"
        value={String(cycleState.lengthDays)}
        disabled={saveCycle.isPending}
        onChange={(e) => { setLength(e.target.value); }}
      >
        {LENGTH_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} disabled={!canSetCycleLength(cycleState, today, Number(o.value))}>
            {o.label}
          </option>
        ))}
      </Field>
      {LENGTH_OPTIONS.some((o) => !canSetCycleLength(cycleState, today, Number(o.value))) && (
        <p className={styles.hint}>Durée trop courte pour le bloc en cours : certaines durées sont indisponibles.</p>
      )}
      <p className={styles.hint}>{nextCycleLine(cycleState, today)}</p>
      <div className={styles.postpone}>
        <Button
          variant="secondary"
          disabled={saveCycle.isPending}
          onClick={() => { saveState(postponeCycle(cycleState, today)); }}
        >
          Reporter d’une semaine
        </Button>
        <Button
          variant="secondary"
          disabled={saveCycle.isPending || !canCancelPostpone(cycleState, today)}
          onClick={() => { saveState(cancelPostpone(cycleState, today)); }}
        >
          Annuler le report
        </Button>
      </div>
    </>
  ) : (
    <p className={styles.hint}>{upcomingHint(cycleState, today, shownCycle)}</p>
  );

  const sessionsPending = sessionsQuery.isPending || (cycleUnknown && cycleQuery.isPending);

  return (
    <div className={styles.screen}>
      <PageHeader
        title="Programme"
        actions={
          <IconButton
            icon="plus"
            label="Ajouter une séance"
            variant="surface"
            onClick={() => { setBuilder({ session: null }); }}
          />
        }
      />

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
              className={cx(styles.tab, selected && styles.tabSelected)}
              onClick={() => { setTab(c); }}
              onKeyDown={onTabKey}
            >
              <span className={styles.tabLetter}>{c}</span> {cycleState ? tabCaption(cycleState, today, c) : ''}
            </button>
          );
        })}
      </div>

      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${shownCycle}`} className={styles.panel}>
        <div className={styles.duration}>{duration}</div>

        {exercisesQuery.isError && (
          <ErrorNotice
            message="Impossible de charger les exercices : le démarrage d’une séance est indisponible."
            onRetry={() => { void exercisesQuery.refetch(); }}
          />
        )}

        {cycleUnknown && cycleQuery.isError ? null : sessionsPending ? (
          <div className={styles.loading} role="status" aria-busy="true">
            <span className="visually-hidden">Chargement des séances…</span>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </div>
        ) : sessionsQuery.isError ? (
          <ErrorNotice message="Impossible de charger les séances." onRetry={() => { void sessionsQuery.refetch(); }} />
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
            {list.map((s) => renderSession(s, sessionCode(shownCycle)))}
          </ul>
        )}

        {unassigned.length > 0 && (
          <section className={styles.unassigned} aria-labelledby={`${ids}-unassigned`}>
            <SectionTitle id={`${ids}-unassigned`}>Sans cycle</SectionTitle>
            <p className={styles.hint}>Modifie ces séances pour les ranger dans le cycle A ou B.</p>
            <ul className={styles.sessions} aria-label="Séances sans cycle">
              {unassigned.map((s) => renderSession(s, null))}
            </ul>
          </section>
        )}
      </div>

      {sessionsQuery.data && <WeekPlanSection sessions={sessionsQuery.data} cycle={shownCycle} />}

      <WarmupSection />

      {builder && (
        <SessionBuilder
          session={builder.session}
          defaultCycle={shownCycle}
          onClose={() => { setBuilder(null); }}
        />
      )}

      <FormSheet
        open={formFor !== null}
        onClose={() => { setFormFor(null); }}
        onPick={(form) => {
          const session = formFor;
          setFormFor(null);
          if (session) launch(session, form);
        }}
      />

      <ConfirmDialog
        open={pendingStart !== null}
        title="Abandonner la séance en cours ?"
        message={`« ${active?.sessionName ?? ''} » est en cours. Démarrer « ${pendingStart?.name ?? ''} » l’abandonne : les séries saisies, pas encore enregistrées, seront perdues.`}
        confirmLabel="Abandonner et démarrer"
        danger
        onConfirm={() => {
          const session = pendingStart;
          setPendingStart(null);
          if (session) setFormFor(session);
        }}
        onCancel={() => { setPendingStart(null); }}
      />
    </div>
  );
}
