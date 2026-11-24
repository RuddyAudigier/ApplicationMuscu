import { useState } from 'react';
import type { CycleState, Exercise, IsoDate, Performance, Session, WeekPlan } from '@/domain/model';
import {
  dayLabel,
  moveOccurrence,
  moveTargets,
  resetOccurrence,
  skipOccurrence,
  weekAgenda,
  weekOccurrences,
  type Occurrence,
} from '@/domain/planning';
import { useSaveWeekPlan } from '@/data/queries';
import { Button, Icon, Sheet, useToast } from '@/ui';
import styles from './HomeScreen.module.css';
import own from './ScheduledSessions.module.css';

const plural = (n: number, one: string, many: string): string => `${String(n)} ${n > 1 ? many : one}`;

/** Choix du jour où décaler une séance (cette semaine, d'aujourd'hui à dimanche). */
function MoveSheet({
  occurrence,
  occurrences,
  today,
  onPick,
  onClose,
}: {
  occurrence: Occurrence;
  occurrences: Occurrence[];
  today: IsoDate;
  onPick: (date: IsoDate) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open onClose={onClose} title={`Décaler ${occurrence.code} ${occurrence.session.name}`}>
      <ul className={own.targets}>
        {moveTargets(today).map((date) => {
          const busy = occurrences.filter((o) => o !== occurrence && o.date === date && o.status !== 'skipped');
          const current = date === occurrence.date;
          return (
            <li key={date}>
              <button
                type="button"
                className={own.target}
                aria-current={current || undefined}
                onClick={() => { onPick(date); }}
              >
                <span className={own.targetDay}>{date === today ? `Aujourd’hui (${dayLabel(date)})` : dayLabel(date)}</span>
                {busy.length > 0 && (
                  <span className={own.targetBusy}>Déjà prévu : {busy.map((o) => o.code).join(', ')}</span>
                )}
                {current && <span className={own.targetBusy}>Jour actuel</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {occurrence.moved && (
        <Button variant="ghost" onClick={() => { onPick(occurrence.plannedDate); }}>
          Remettre au jour prévu ({dayLabel(occurrence.plannedDate)})
        </Button>
      )}
    </Sheet>
  );
}

/**
 * Accueil quand une semaine type est réglée : séances manquées (faire / décaler / sauter),
 * puis la prochaine séance, qu'on peut démarrer en avance.
 */
export function ScheduledSessions({
  plan,
  sessions,
  cycleState,
  perfs,
  exercises,
  today,
  onStart,
}: {
  plan: WeekPlan;
  sessions: Session[];
  cycleState: CycleState;
  perfs: Performance[];
  exercises: Exercise[] | null;
  today: IsoDate;
  onStart: (s: Session, exercises: Exercise[]) => void;
}) {
  const toast = useToast();
  const save = useSaveWeekPlan();
  const [moving, setMoving] = useState<Occurrence | null>(null);

  const occurrences = weekOccurrences(plan, sessions, cycleState, perfs, today);
  const { missed, next } = weekAgenda(occurrences);
  const skipped = occurrences.filter((o) => o.status === 'skipped');

  const persist = (p: WeekPlan, done: string): void => {
    save.mutate(p, {
      onSuccess: () => { toast.show(done, 'success'); },
      onError: (e) => { toast.show(`Planning non enregistré : ${e.message}`, 'error'); },
    });
  };
  const start = (o: Occurrence): void => {
    if (exercises) onStart(o.session, exercises);
  };
  const actions = (o: Occurrence) => (
    <div className={own.actions}>
      <Button variant="ghost" disabled={save.isPending} onClick={() => { setMoving(o); }}>Décaler…</Button>
      <Button
        variant="ghost"
        disabled={save.isPending}
        onClick={() => { persist(skipOccurrence(plan, today, o.day), `${o.code} sautée cette semaine.`); }}
      >
        Sauter cette semaine
      </Button>
    </div>
  );

  return (
    <>
      {missed.map((o) => (
        <div key={o.day} className={own.missed} role="group" aria-label={`Séance manquée : ${o.code} ${o.session.name}`}>
          <span className={own.missedKicker}>
            <Icon name="info" size={16} /> Séance manquée · {dayLabel(o.date)}
          </span>
          <span className={own.missedName}>{o.code} · {o.session.name}</span>
          <div className={own.actions}>
            <Button variant="accent" disabled={exercises === null} onClick={() => { start(o); }}>
              La faire maintenant
            </Button>
          </div>
          {actions(o)}
        </div>
      ))}

      {next ? (
        <>
          <button
            type="button"
            className={styles.dayCard}
            onClick={() => { start(next); }}
            disabled={exercises === null}
          >
            <span className="visually-hidden">Démarrer </span>
            <div className={styles.dayHead}>
              <div className={styles.dayTitles}>
                <span className={styles.dayKicker}>
                  {next.status === 'today' ? 'Séance du jour' : `Prochaine séance · ${dayLabel(next.date)}`} · {next.code}
                </span>{' '}
                <span className={styles.dayName}>{next.session.name}</span>
              </div>
              <span className={styles.play}><Icon name="play" size={20} /></span>
            </div>{' '}
            <div className={styles.dayStats}>
              <span className={styles.dayNumber}>{next.session.exercises.reduce((n, e) => n + e.series, 0)}</span>{' '}
              <span className={styles.dayText}>
                séries prévues
                <br />
                sur {plural(next.session.exercises.length, 'exercice', 'exercices')}
                {next.status === 'upcoming' && ' · en avance'}
              </span>
            </div>
          </button>
          {actions(next)}
        </>
      ) : (
        missed.length === 0 && (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Semaine bouclée</h2>
            <p className={styles.emptyText}>Toutes les séances prévues cette semaine sont faites ou sautées.</p>
          </div>
        )
      )}

      {skipped.map((o) => (
        <p key={o.day} className={own.skipped}>
          {o.code} {o.session.name} sautée cette semaine ({dayLabel(o.plannedDate)}).{' '}
          <button
            type="button"
            className={own.undo}
            disabled={save.isPending}
            onClick={() => { persist(resetOccurrence(plan, today, o.day), `${o.code} remise au planning.`); }}
          >
            Annuler
          </button>
        </p>
      ))}

      {moving && (
        <MoveSheet
          occurrence={moving}
          occurrences={occurrences}
          today={today}
          onClose={() => { setMoving(null); }}
          onPick={(date) => {
            setMoving(null);
            persist(moveOccurrence(plan, today, moving.day, date), `${moving.code} décalée à ${dayLabel(date)}.`);
          }}
        />
      )}
    </>
  );
}
