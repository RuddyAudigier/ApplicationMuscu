import { useId } from 'react';
import { todayIso } from '@/domain/dates';
import type { Session } from '@/domain/model';
import { emptyWeekPlan, setPlanDay, WEEKDAYS } from '@/domain/planning';
import { sessionsOfCycle } from '@/domain/sessions';
import { useSaveWeekPlan, useWeekPlan } from '@/data/queries';
import { Button, Field, Skeleton, useToast } from '@/ui';
import styles from './WeekPlanSection.module.css';

/** Libellé d'un créneau : « Séance 1 · A1 Jambes / B1 Jambes bis ». */
function slotLabel(rank: number, a: Session[], b: Session[]): string {
  const part = (c: 'A' | 'B', s: Session | undefined): string | null => (s ? `${c}${String(rank + 1)} ${s.name}` : null);
  const names = [part('A', a[rank]), part('B', b[rank])].filter(Boolean).join(' / ');
  return `Séance ${String(rank + 1)}${names ? ` · ${names}` : ''}`;
}

/**
 * « Ma semaine » : quel jour on fait quelle séance. Un créneau vaut pour les deux cycles
 * (séance 1 = A1 en cycle A, B1 en cycle B), puisque A et B travaillent les mêmes muscles.
 */
export function WeekPlanSection({ sessions }: { sessions: Session[] }) {
  const id = useId();
  const toast = useToast();
  const planQuery = useWeekPlan();
  const save = useSaveWeekPlan();
  const a = sessionsOfCycle(sessions, 'A');
  const b = sessionsOfCycle(sessions, 'B');
  const slots = Math.max(a.length, b.length);

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
  } else if (slots === 0) {
    body = <p className={styles.hint}>Crée d’abord tes séances A et B.</p>;
  } else {
    const plan = planQuery.data ?? emptyWeekPlan();
    const change = (day: number, value: string): void => {
      const next = setPlanDay(plan, todayIso(), day, value === '' ? null : Number(value));
      save.mutate(next, {
        onError: (e) => { toast.show(`Planning non enregistré : ${e.message}`, 'error'); },
      });
    };
    body = (
      <ul className={styles.days}>
        {WEEKDAYS.map((name, day) => (
          <li key={name}>
            <Field
              as="select"
              label={name}
              value={plan.days[day] === null || plan.days[day] === undefined ? '' : String(plan.days[day])}
              disabled={save.isPending}
              onChange={(e) => { change(day, e.target.value); }}
            >
              <option value="">Repos</option>
              {Array.from({ length: slots }, (_, rank) => (
                <option key={rank} value={rank}>{slotLabel(rank, a, b)}</option>
              ))}
            </Field>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>Ma semaine</h2>
      <p className={styles.hint}>
        Choisis tes jours d’entraînement. Séance 1 = A1 en cycle A, B1 en cycle B : la bascule est automatique.
      </p>
      {body}
    </section>
  );
}
