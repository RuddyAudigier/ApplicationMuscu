import { useMemo, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { cycleStatus, defaultCycleState } from '@/domain/cycles';
import { todayIso } from '@/domain/dates';
import type { Performance, Session } from '@/domain/model';
import { formatWeight } from '@/domain/numbers';
import { DEFAULT_VARIANT, variantLabel } from '@/domain/variants';
import { startWorkout } from '@/domain/workout';
import { normalizeVariantName } from '@/domain/names';
import { useCycleState, useExercises, useHistoryIndex, usePerformances, useSessions } from '@/data/queries';
import { loadActiveWorkout, loadLastReport, saveActiveWorkout, saveLastReport } from '@/features/workout';
import { Icon, Skeleton } from '@/ui';
import { latestPrs, PR_LABEL, relativeDay, sessionOfDay, weekSegments, type WeekSegment } from './homeLogic';
import styles from './HomeScreen.module.css';

const EMPTY_PERFS: Performance[] = [];

const plural = (n: number, one: string, many: string): string => `${String(n)} ${n > 1 ? many : one}`;

function Timeline({ segments }: { segments: WeekSegment[] }) {
  const current = segments.find((s) => s.status === 'current');
  const past = segments.find((s) => s.status === 'past');
  const future = segments.find((s) => s.status === 'future');
  const label = [
    past && `cycle ${past.cycle} terminé`,
    current && `cycle ${current.cycle} en cours`,
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

function SessionCard({
  sessions,
  loading,
  failed,
  cycle,
  perfs,
  today,
  onStart,
  starting,
}: {
  sessions: Session[] | undefined;
  loading: boolean;
  failed: boolean;
  cycle: 'A' | 'B';
  perfs: Performance[];
  today: string;
  onStart: (s: Session) => void;
  starting: boolean;
}) {
  const active = loadActiveWorkout();
  if (active) {
    const done = active.exercises.reduce((n, e) => n + e.series.filter((s) => s.validated).length, 0);
    return (
      <Link to="/workout" className={styles.dayCard} aria-label={`Reprendre ${active.sessionName}`}>
        <div className={styles.dayHead}>
          <div className={styles.dayTitles}>
            <span className={styles.dayKicker}>Séance en cours{active.cycle ? ` · Cycle ${active.cycle}` : ''}</span>
            <span className={styles.dayName}>{active.sessionName}</span>
          </div>
          <span className={styles.play}><Icon name="play" size={20} /></span>
        </div>
        <div className={styles.dayStats}>
          <span className={styles.dayNumber}>{done}</span>
          <span className={styles.dayText}>
            {done > 1 ? 'séries validées' : 'série validée'}
            <br />
            Reprendre
          </span>
        </div>
      </Link>
    );
  }

  if (loading) {
    return (
      <div className={styles.skeletonCard} aria-busy="true">
        <span className="visually-hidden">Chargement des séances…</span>
        <Skeleton height={132} />
      </div>
    );
  }
  if (failed || sessions === undefined) {
    return <p className={styles.notice} role="alert">Impossible de charger les séances. Vérifie ta connexion puis réessaie.</p>;
  }
  if (sessions.length === 0) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>Aucune séance</h2>
        <p className={styles.emptyText}>Crée les séances de tes cycles A et B pour commencer.</p>
        <Link to="/program" className={styles.cta}>Créer mon programme</Link>
      </div>
    );
  }

  const day = sessionOfDay(sessions, cycle, perfs, today);
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

  const { session } = day;
  const series = session.exercises.reduce((n, e) => n + e.series, 0);
  return (
    <button
      type="button"
      className={styles.dayCard}
      onClick={() => { onStart(session); }}
      disabled={starting}
      aria-label={`Démarrer ${session.name}`}
    >
      <div className={styles.dayHead}>
        <div className={styles.dayTitles}>
          <span className={styles.dayKicker}>Séance du jour · Cycle {cycle}</span>
          <span className={styles.dayName}>{session.name}</span>
        </div>
        <span className={styles.play}><Icon name="play" size={20} /></span>
      </div>
      <div className={styles.dayStats}>
        <span className={styles.dayNumber}>{series}</span>
        <span className={styles.dayText}>
          {series > 1 ? 'séries prévues' : 'série prévue'}
          <br />
          sur {plural(session.exercises.length, 'exercice', 'exercices')}
        </span>
      </div>
    </button>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const today = todayIso();
  const cycleQuery = useCycleState();
  const sessionsQuery = useSessions();
  const exercisesQuery = useExercises();
  const perfsQuery = usePerformances();
  const index = useHistoryIndex();
  const perfs = perfsQuery.data ?? EMPTY_PERFS;

  const state = cycleQuery.data ?? defaultCycleState(today);
  const status = cycleStatus(state, today);
  const segments = weekSegments(state, today, status.weeks);
  const prs = useMemo(() => latestPrs(perfs, index), [perfs, index]);
  const lastReport = loadLastReport();

  const start = (session: Session): void => {
    saveActiveWorkout(startWorkout(session, exercisesQuery.data ?? [], new Date()));
    // Le dernier compte rendu reste visible jusqu'à la séance suivante.
    saveLastReport(null);
    void navigate('/workout');
  };

  return (
    <div className={styles.screen}>
      <h1 className="visually-hidden">Accueil</h1>
      <header className={styles.top}>
        <span className={styles.brand}>mymuscle<span className={styles.dot}>.</span></span>
        <Link to="/settings" aria-label="Réglages" className={styles.settings}>
          <Icon name="sliders" size={20} />
        </Link>
      </header>

      <section className={styles.cycle} aria-label="Cycle en cours" aria-busy={cycleQuery.isPending || undefined}>
        {cycleQuery.isPending ? (
          <>
            <span className="visually-hidden">Chargement du cycle…</span>
            <Skeleton height={65} />
            <Skeleton height={23} />
          </>
        ) : (
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
            <Timeline segments={segments} />
          </>
        )}
      </section>

      <SessionCard
        sessions={sessionsQuery.data}
        loading={sessionsQuery.isPending}
        failed={sessionsQuery.isError}
        cycle={status.current}
        perfs={perfs}
        today={today}
        onStart={start}
        starting={exercisesQuery.isPending}
      />

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

      <section className={styles.prs} aria-labelledby="home-prs">
        <div className={styles.prsHead}>
          <h2 id="home-prs" className={styles.prsTitle}>Derniers PR</h2>
          <Link to="/records" className={styles.seeAll}>Tout voir</Link>
        </div>
        {prs.length === 0 ? (
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
