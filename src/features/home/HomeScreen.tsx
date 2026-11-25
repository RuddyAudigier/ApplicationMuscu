import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { cycleStatus, defaultCycleState } from '@/domain/cycles';
import { todayIso } from '@/domain/dates';
import type { CycleId, CycleState, Exercise, Performance, Session, WeekPlan } from '@/domain/model';
import { normalizeVariantName } from '@/domain/names';
import { formatWeight } from '@/domain/numbers';
import { latestPrs } from '@/domain/records';
import { DEFAULT_VARIANT, variantLabel } from '@/domain/variants';
import { warmupsForSession, type Form } from '@/domain/journal';
import { startWorkout, type WorkoutState } from '@/domain/workout';
import { hasSchedule } from '@/domain/planning';
import { useCycleState, useExercises, useJournal, usePerformances, useSessions, useWeekPlan } from '@/data/queries';
import {
  FormSheet,
  isJournalSettled,
  loadActiveWorkout,
  loadLastReport,
  saveActiveWorkout,
  saveLastReport,
  usePendingReportSync,
} from '@/features/workout';
import { Button, Icon, IconButton, PageHeader, Skeleton } from '@/ui';
import { monthGrid, nextPlannedSession, PR_LABEL, relativeDay, weekSegments, type WeekSegment } from './homeLogic';
import styles from './HomeScreen.module.css';
import { ScheduledSessions } from './ScheduledSessions';

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function MonthCalendar({ perfs, cycleState, today }: { perfs: Performance[]; cycleState: CycleState; today: string }) {
  const [shown, setShown] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const { year, month } = shown;
  const grid = useMemo(() => monthGrid(year, month, perfs, cycleState, today), [year, month, perfs, cycleState, today]);
  const step = (delta: number): void => {
    const d = new Date(year, month - 1 + delta, 1);
    setShown({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };
  const name = MONTHS[month - 1] ?? '';
  return (
    <section className={styles.calendar} aria-labelledby="home-month">
      <div className={styles.calHead}>
        <div className={styles.calTitles}>
          <h2 id="home-month" className={styles.prsTitle}>Ce mois-ci</h2>
          <span className={styles.calMonth}>{name} {year}</span>
        </div>
        <div className={styles.calNav}>
          <IconButton icon="back" label="Mois précédent" onClick={() => { step(-1); }} />
          <IconButton icon="chevron" label="Mois suivant" onClick={() => { step(1); }} />
        </div>
      </div>
      <div className={styles.calGrid}>
        {INITIALS.map((l, i) => (
          <span key={i} className={styles.calDow} aria-hidden="true">{l}</span>
        ))}
        {grid.weeks.flat().map((cell, i) => {
          if (!cell) return <span key={i} />;
          const day = Number(cell.date.slice(8, 10));
          const label = `${String(day)} ${name}${cell.trained ? ` : séance (cycle ${cell.cycle})` : ''}`;
          return (
            <span
              key={i}
              className={styles.calDay}
              data-trained={cell.trained || undefined}
              data-cycle={cell.cycle}
              data-today={cell.isToday || undefined}
>
              <span className="visually-hidden">{label}</span>
              <span className={styles.calNum} aria-hidden="true">{day}</span>
            </span>
          );
        })}
      </div>
      <p className={styles.calTotal}>{plural(grid.sessions, 'séance', 'séances')}</p>
    </section>
  );
}

const plural = (n: number, one: string, many: string): string => `${String(n)} ${n > 1 ? many : one}`;

/** Vue minimale d'une requête (données dérivées possibles, ex. cycle courant). */
interface Query<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<unknown>;
}

/** Relance seulement les requêtes en erreur. */
const retry = (...queries: Query<unknown>[]) => (): void => {
  for (const q of queries) if (q.isError) void q.refetch();
};

/** Erreur de chargement honnête (D8) avec relance. */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.notice} role="alert">
      <p className={styles.noticeText}>{message}</p>
      <Button variant="secondary" onClick={onRetry}>Réessayer</Button>
    </div>
  );
}

function Timeline({ segments }: { segments: WeekSegment[] }) {
  const current = segments.find((s) => s.status === 'current');
  // Semaines restantes du bloc en cours = segments consécutifs du même cycle en tête de frise.
  const changeAt = segments.findIndex((s) => s.cycle !== current?.cycle);
  const left = changeAt === -1 ? segments.length : changeAt;
  const future = segments.find((s) => s.cycle !== current?.cycle);
  const label = [
    current && `cycle ${current.cycle} en cours, ${left > 1 ? `${String(left)} semaines restantes` : 'dernière semaine'}`,
    future && `puis cycle ${future.cycle}`,
  ].filter(Boolean).join(', ');
  return (
    <div
      className={styles.timeline}
      role="img"
      aria-label={`Frise des cycles : ${label}`}
      style={{ gridTemplateColumns: `repeat(${String(segments.length)}, minmax(0, 1fr))` }}
    >
      {segments.map((s, i) => (
        <div key={i} className={styles.segment} data-status={s.status}>
          <span className={styles.bar} style={{ '--fill': `${String(Math.round(s.fill * 100))}%` } as CSSProperties} />
          <span className={styles.segmentLabel}>{s.cycle}</span>
        </div>
      ))}
    </div>
  );
}

function ActiveCard({ active }: { active: WorkoutState }) {
  const done = active.exercises.reduce((n, e) => n + e.series.filter((s) => s.validated).length, 0);
  return (
    // Nom accessible = texte visible (WCAG 2.5.3) ; les espaces explicites séparent les mots.
    <Link to="/workout" className={styles.dayCard}>
      <span className="visually-hidden">Reprendre </span>
      <div className={styles.dayHead}>
        <div className={styles.dayTitles}>
          <span className={styles.dayKicker}>Séance en cours{active.cycle ? ` · Cycle ${active.cycle}` : ''}</span>{' '}
          <span className={styles.dayName}>{active.sessionName}</span>
        </div>
        <span className={styles.play}><Icon name="play" size={20} /></span>
      </div>{' '}
      <div className={styles.dayStats}>
        <span className={styles.dayNumber}>{done}</span>{' '}
        <span className={styles.dayText}>
          {done > 1 ? 'séries validées' : 'série validée'}
          <br />
          Reprendre
        </span>
      </div>
    </Link>
  );
}

function SessionCard({
  cycle,
  cycleState,
  plan,
  sessionsQuery,
  perfsQuery,
  exercisesQuery,
  today,
  onStart,
}: {
  cycle: Query<CycleId>;
  cycleState: CycleState | null;
  /** Semaine type : `undefined` tant qu'elle charge (ou en erreur → mode sans planning). */
  plan: WeekPlan | null | undefined;
  sessionsQuery: Query<Session[]>;
  perfsQuery: Query<Performance[]>;
  exercisesQuery: Query<Exercise[]>;
  today: string;
  onStart: (s: Session, exercises: Exercise[]) => void;
}) {
  if (sessionsQuery.isError) {
    return (
      <LoadError message="Impossible de charger les séances. Vérifie ta connexion puis réessaie." onRetry={retry(sessionsQuery)} />
    );
  }
  if (sessionsQuery.data?.length === 0) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>Aucune séance</h2>
        <p className={styles.emptyText}>Crée les séances de tes cycles A et B pour commencer.</p>
        <Link to="/program" className={styles.cta}>Créer mon programme</Link>
      </div>
    );
  }
  if (perfsQuery.isError || cycle.isError) {
    return (
      <LoadError
        message="Impossible de déterminer la séance du jour : historique ou cycle indisponible."
        onRetry={retry(perfsQuery, cycle)}
      />
    );
  }
  if (sessionsQuery.data === undefined || perfsQuery.data === undefined || cycle.data === undefined || plan === undefined) {
    return (
      <div className={styles.skeletonCard} aria-busy="true">
        <span className="visually-hidden">Chargement de la séance du jour…</span>
        <Skeleton height={132} />
      </div>
    );
  }

  if (hasSchedule(plan) && cycleState) {
    return (
      <ScheduledSessions
        plan={plan}
        sessions={sessionsQuery.data}
        cycleState={cycleState}
        perfs={perfsQuery.data}
        exercises={exercisesQuery.isSuccess ? (exercisesQuery.data ?? null) : null}
        today={today}
        onStart={onStart}
      />
    );
  }

  const day = nextPlannedSession(sessionsQuery.data, cycle.data, perfsQuery.data, today);
  if (day.kind !== 'next') {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>
          {day.kind === 'all-done' ? 'Semaine bouclée' : `Aucune séance dans le cycle ${day.cycle}`}
        </h2>
        <p className={styles.emptyText}>
          {day.kind === 'all-done'
            ? `Toutes les séances du cycle ${day.cycle} sont faites cette semaine.`
            : `Ajoute une séance au cycle ${day.cycle} dans ton programme.`}
        </p>
        <Link to="/program" className={styles.cta}>Voir le programme</Link>
      </div>
    );
  }

  const { session, code } = day;
  const series = session.exercises.reduce((n, e) => n + e.series, 0);
  // Jamais de démarrage sur une liste d'exercices de repli : il faut les vraies variantes.
  const exercises = exercisesQuery.isSuccess ? (exercisesQuery.data ?? null) : null;
  return (
    <>
      <button
        type="button"
        className={styles.dayCard}
        onClick={() => {
          if (exercises) onStart(session, exercises);
        }}
        disabled={exercises === null}
      >
        {/* Nom accessible = texte visible (WCAG 2.5.3) ; les espaces explicites séparent les mots. */}
        <span className="visually-hidden">Démarrer </span>
        <div className={styles.dayHead}>
          <div className={styles.dayTitles}>
            <span className={styles.dayKicker}>Séance du jour · {code}</span>{' '}
            <span className={styles.dayName}>{session.name}</span>
          </div>
          <span className={styles.play}><Icon name="play" size={20} /></span>
        </div>{' '}
        <div className={styles.dayStats}>
          <span className={styles.dayNumber}>{series}</span>{' '}
          <span className={styles.dayText}>
            {series > 1 ? 'séries prévues' : 'série prévue'}
            <br />
            sur {plural(session.exercises.length, 'exercice', 'exercices')}
          </span>
        </div>
      </button>
      {exercisesQuery.isError && (
        <LoadError
          message="Impossible de charger les exercices : la séance ne peut pas démarrer."
          onRetry={retry(exercisesQuery)}
        />
      )}
    </>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const today = todayIso();
  const cycleQuery = useCycleState();
  const sessionsQuery = useSessions();
  const exercisesQuery = useExercises();
  const perfsQuery = usePerformances();
  const planQuery = useWeekPlan();
  const journalQuery = useJournal();
  // Lus une seule fois par affichage de l'écran.
  const [active] = useState(loadActiveWorkout);
  const [lastReport] = useState(loadLastReport);
  // Séance terminée hors ligne : rejoint le journal dès qu'il est lisible (silencieux).
  const pushPendingReport = usePendingReportSync(true);

  // Défaut seulement si la requête a réussi sans état enregistré ; jamais en cas d'erreur (D8).
  const state = cycleQuery.isSuccess ? (cycleQuery.data ?? defaultCycleState(today)) : null;
  const status = state ? cycleStatus(state, today) : null;
  const segments = state && status ? weekSegments(state, today) : [];
  const cycle: Query<CycleId> = { ...cycleQuery, data: status?.current };
  const prs = useMemo(() => (perfsQuery.data ? latestPrs(perfsQuery.data) : []), [perfsQuery.data]);

  // Séance à démarrer, en attente du choix de la forme du jour.
  const [pending, setPending] = useState<{ session: Session; exercises: Exercise[] } | null>(null);
  const start = (session: Session, exercises: Exercise[]): void => {
    setPending({ session, exercises });
  };
  const launch = (form: Form): void => {
    if (!pending) return;
    saveActiveWorkout(
      startWorkout(pending.session, pending.exercises, new Date(), form, warmupsForSession(journalQuery.data, pending.session.id)),
    );
    setPending(null);
    // Le dernier compte rendu reste visible jusqu'à la séance suivante : on le rattrape d'abord.
    pushPendingReport();
    saveLastReport(null);
    void navigate('/workout');
  };

  return (
    <div className={styles.screen}>
      <h1 className="visually-hidden">Accueil</h1>
      <PageHeader
        decorative
        title={<>mymuscle<span className={styles.dot}>.</span></>}
        actions={
          <Link to="/settings" aria-label="Réglages" className={styles.settings}>
            <Icon name="sliders" size={20} />
          </Link>
        }
      />

      <section className={styles.cycle} aria-label="Cycle en cours" aria-busy={cycleQuery.isPending || undefined}>
        {cycleQuery.isError && (
          <LoadError message="Impossible de charger ton cycle A/B. Vérifie ta connexion puis réessaie." onRetry={retry(cycleQuery)} />
        )}
        {cycleQuery.isPending && (
          <>
            <span className="visually-hidden">Chargement du cycle…</span>
            <Skeleton height={65} />
            <Skeleton height={23} />
          </>
        )}
        {status && (
          <>
            <div className={styles.cycleRow}>
              <div className={styles.cycleMain}>
                <span className={styles.bigLetter} aria-hidden="true">{status.current}</span>
                <div className={styles.cycleTitles}>
                  <h2 className={styles.cycleName}>Cycle {status.current}</h2>
                  <span className={styles.muted}>Semaine {status.week} sur {status.weeks}</span>
                </div>
              </div>
              <p className={styles.switch}>
                Bascule vers {status.next}
                <br />
                <span className={styles.switchDays}>dans {plural(status.daysLeft, 'jour', 'jours')}</span>
              </p>
            </div>
            <Link to="/bilan" className={styles.timelineLink}>
              <Timeline segments={segments} />
            </Link>
          </>
        )}
      </section>

      {active ? (
        <ActiveCard active={active} />
      ) : (
        <SessionCard
          cycle={cycle}
          cycleState={state}
          plan={planQuery.isPending ? undefined : (planQuery.data ?? null)}
          sessionsQuery={sessionsQuery}
          perfsQuery={perfsQuery}
          // Démarrage seulement journal fixé : sinon les échauffements seraient perdus en silence.
          exercisesQuery={{ ...exercisesQuery, isSuccess: exercisesQuery.isSuccess && isJournalSettled(journalQuery) }}
          today={today}
          onStart={start}
        />
      )}

      <FormSheet open={pending !== null} onClose={() => { setPending(null); }} onPick={launch} />

      {lastReport && (
        <Link to="/report" className={styles.report}>
          <span className={styles.reportTitles}>
            <span className={styles.reportKicker}>Dernier compte rendu</span>
            <span className={styles.reportName}>{lastReport.title}</span>
          </span>
          <span className={styles.reportMeta}>
            {plural(lastReport.prCount, 'PR', 'PR')}
            <Icon name="chevron" size={18} />
          </span>
        </Link>
      )}

      {status && (
        <Link to="/bilan" className={[styles.review, status.daysLeft <= 3 && styles.reviewAccent].filter(Boolean).join(' ')}>
          <span className={styles.reportTitles}>
            <span className={styles.reportKicker}>
              {status.daysLeft <= 1 ? 'Dernier jour du bloc' : status.daysLeft <= 3 ? `Fin du bloc dans ${plural(status.daysLeft, 'jour', 'jours')}` : 'Cycle ' + status.current}
            </span>
            <span className={styles.reportName}>Bilan du bloc</span>
          </span>
          <span className={styles.reportMeta}><Icon name="chevron" size={18} /></span>
        </Link>
      )}

      {state && perfsQuery.data && <MonthCalendar perfs={perfsQuery.data} cycleState={state} today={today} />}

      <section className={styles.prs} aria-labelledby="home-prs">
        <div className={styles.prsHead}>
          <h2 id="home-prs" className={styles.prsTitle}>Derniers PR</h2>
          <Link to="/records" className={styles.seeAll}>Tout voir</Link>
        </div>
        {perfsQuery.isError ? (
          <LoadError message="Impossible de charger tes performances : PR indisponibles." onRetry={retry(perfsQuery)} />
        ) : prs.length === 0 ? (
          <p className={styles.prsEmpty}>
            {perfsQuery.isPending ? 'Chargement…' : 'Aucun PR pour l’instant. Ta prochaine séance en fera tomber.'}
          </p>
        ) : (
          <ul className={styles.prList}>
            {prs.map((pr) => {
              const variant = normalizeVariantName(pr.variantName) === normalizeVariantName(DEFAULT_VARIANT)
                ? ''
                : ` · ${variantLabel(pr.variantName)}`;
              return (
                <li key={pr.key} className={styles.prRow}>
                  <div className={styles.prTitles}>
                    <span className={styles.prName}>{pr.exerciseName}{variant}</span>
                    <span className={styles.prMeta}>{PR_LABEL[pr.kind]} · {relativeDay(pr.date, today)}</span>
                  </div>
                  <span className={styles.prValue}>
                    {pr.reps} × {formatWeight(pr.weight)}<span className={styles.prUnit}> kg</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
