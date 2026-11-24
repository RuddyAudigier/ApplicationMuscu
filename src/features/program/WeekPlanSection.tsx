import { useId } from 'react';
import { todayIso } from '@/domain/dates';
import type { CycleId, Session } from '@/domain/model';
import { emptyWeekPlan, setPlanDay, WEEKDAYS } from '@/domain/planning';
import { sessionCode, sessionsOfCycle } from '@/domain/sessions';
import { useSaveWeekPlan, useWeekPlan } from '@/data/queries';
import { Button, Field, Skeleton, useToast } from '@/ui';
import styles from './WeekPlanSection.module.css';

/**
 * « Ma semaine » : une semaine type par cycle (celui de l'onglet affiché). Chaque jour, repos
 * ou une séance du cycle : « lundi : Haut du corps, jeudi : Bas du corps, samedi : Full body ».
 */
export function WeekPlanSection({ sessions, cycle }: { sessions: Session[]; cycle: CycleId }) {
  const id = useId();
  const toast = useToast();
  const planQuery = useWeekPlan();
  const save = useSaveWeekPlan();
  const ofCycle = sessionsOfCycle(sessions, cycle);

  let body;
  if (planQuery.isError) {
    body = (
      <div className={styles.error} role="alert">
        <p>Impossible de charger ton planning.</p>
        <Button variant="secondary" onClick={() => { void planQuery.refetch(); }}>Réessayer</Button>
      </div>
    );
  } else if (planQuery.isPending) {
    body = <Skeleton height={160} />;
  } else if (ofCycle.length === 0) {
    body = <p className={styles.hint}>Crée d’abord une séance dans le cycle {cycle}.</p>;
  } else {
    const plan = planQuery.data ?? emptyWeekPlan();
    const change = (day: number, value: string): void => {
      const next = setPlanDay(plan, todayIso(), cycle, day, value === '' ? null : value);
      save.mutate(next, {
        onError: (e) => { toast.show(`Planning non enregistré : ${e.message}`, 'error'); },
      });
    };
    body = (
      <ul className={styles.days}>
        {WEEKDAYS.map((name, day) => {
          const chosen = plan.days[cycle][day] ?? null;
          // Séance supprimée ou passée dans l'autre cycle : affichée comme repos.
          const value = chosen !== null && ofCycle.some((s) => s.id === chosen) ? chosen : '';
          return (
            <li key={name}>
              <Field
                as="select"
                label={name}
                value={value}
                disabled={save.isPending}
                onChange={(e) => { change(day, e.target.value); }}
              >
                <option value="">Repos</option>
                {ofCycle.map((s, rank) => (
                  <option key={s.id} value={s.id}>{sessionCode(cycle, rank)} · {s.name}</option>
                ))}
              </Field>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>Ma semaine · cycle {cycle}</h2>
      <p className={styles.hint}>
        Choisis la séance de chaque jour pendant les semaines du cycle {cycle}. Change d’onglet pour régler
        l’autre cycle : la bascule A/B est automatique.
      </p>
      {body}
    </section>
  );
}
