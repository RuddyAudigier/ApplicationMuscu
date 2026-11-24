import { currentBlock, cycleStatus } from './cycles';
import { parseDateToIso } from './dates';
import type { CycleState, IsoDate, Performance, Session, WeekPlan } from './model';
import { latestPrs } from './records';
import { addDays, mondayOf, weekOccurrences } from './planning';

export interface Reminder {
  /** `yyyymmdd * 10 + rang du jour` (séances 0–8, bascule 9) : stable, donc réutilisable comme id de notification. */
  id: number;
  kind: 'session' | 'switch';
  date: IsoDate;
  title: string;
  body: string;
  largeBody: string;
}

const idOf = (date: IsoDate, rank: number): number => Number(date.replaceAll('-', '')) * 10 + rank;
const plural = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;

/**
 * Rappels des `days` prochains jours (aujourd'hui compris) : une notification par séance prévue
 * (à `timeMinutes`, minutes depuis minuit local) et une la veille de la bascule de cycle.
 * Les rappels d'aujourd'hui dont l'heure est passée sont écartés.
 */
export function planReminders(input: {
  plan: WeekPlan; sessions: Session[]; cycleState: CycleState; perfs: Performance[];
  today: IsoDate; nowMinutes: number; timeMinutes: number; days?: number;
}): Reminder[] {
  const { plan, sessions, cycleState, perfs, today, nowMinutes, timeMinutes, days = 28 } = input;
  const end = addDays(today, days);
  const inWindow = (date: IsoDate): boolean =>
    date >= today && date < end && !(date === today && nowMinutes >= timeMinutes);

  const out: Reminder[] = [];
  const monday = mondayOf(today);
  for (let w = monday; w < end; w = addDays(w, 7)) {
    const rankOfDay = new Map<IsoDate, number>();
    for (const o of weekOccurrences(plan, sessions, cycleState, perfs, w === monday ? today : w)) {
      if ((o.status !== 'today' && o.status !== 'upcoming') || !inWindow(o.date)) continue;
      const rank = rankOfDay.get(o.date) ?? 0;
      if (rank > 8) continue;
      rankOfDay.set(o.date, rank + 1);

      const { current, week, weeks } = cycleStatus(cycleState, o.date);
      const series = o.session.exercises.reduce((sum, e) => sum + e.series, 0);
      const count = o.session.exercises.length;
      const tail = `semaine ${String(week)} sur ${String(weeks)}`;
      out.push({
        id: idOf(o.date, rank),
        kind: 'session',
        date: o.date,
        title: `Cycle ${current} · ${o.session.name}`,
        body: `${plural(count, 'exercice', 'exercices')} · ${plural(series, 'série', 'séries')} · ${tail}`,
        largeBody: `${o.session.exercises.map((e) => e.name).join(' · ')}\n${String(series)} séries prévues · ${tail}`,
      });
    }
  }

  const status = cycleStatus(cycleState, today);
  const switchDate = addDays(today, status.daysLeft - 1);
  if (inWindow(switchDate)) {
    const from = currentBlock(cycleState, today).startedOn;
    const done = new Set<string>();
    for (const p of perfs) {
      const d = parseDateToIso(p.performanceDate);
      if (d !== null && d >= from && d <= today) done.add(`${d}|${p.sessionName}`);
    }
    const prs = latestPrs(perfs, Infinity).filter((pr) => pr.date >= from && pr.date <= today).length;
    const body = `Bloc ${status.current} terminé · ${plural(done.size, 'séance', 'séances')} · ${String(prs)} PR`;
    out.push({
      id: idOf(switchDate, 9),
      kind: 'switch',
      date: switchDate,
      title: `Demain : début du cycle ${status.next}`,
      body,
      largeBody: `${body}\nPrépare ton bilan pour le coach.`,
    });
  }

  return out.sort((a, b) => a.id - b.id);
}
