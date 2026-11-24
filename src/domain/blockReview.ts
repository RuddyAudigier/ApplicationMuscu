import { currentBlock } from './cycles';
import { parseDateToIso } from './dates';
import { FEELINGS, type Feeling, type Form, type Journal } from './journal';
import type { CycleId, CycleState, IsoDate, Performance, Session, WeekPlan } from './model';
import { addDays, mondayOf, weekOccurrences } from './planning';
import { latestPrs, type RecentPr } from './records';

/** Bloc de cycle : `end` inclus. */
export interface BlockRange { cycle: CycleId; start: IsoDate; end: IsoDate }

const other = (c: CycleId): CycleId => (c === 'A' ? 'B' : 'A');

/**
 * Bloc en cours puis blocs précédents, `count` au total. Les blocs passés sont reconstitués en
 * reculant de la durée générale en alternant le cycle : l'historique des reports n'est pas stocké (approximation).
 */
export function recentBlocks(state: CycleState, today: IsoDate, count = 6): BlockRange[] {
  const cur = currentBlock(state, today);
  const out: BlockRange[] = [{ cycle: cur.current, start: cur.startedOn, end: addDays(cur.startedOn, cur.lengthDays + cur.extraDays - 1) }];
  let cycle = cur.current;
  let start = cur.startedOn;
  while (out.length < count) {
    cycle = other(cycle);
    start = addDays(start, -cur.lengthDays);
    out.push({ cycle, start, end: addDays(start, cur.lengthDays - 1) });
  }
  return out;
}

export interface BlockReview {
  sessionsDone: number; sessionsPlanned: number;
  /** Sautées volontairement (`skipped`) ; les séances oubliées sont comptées à part (`missed`). */
  sessionsSkipped: number; sessionsMissed: number;
  prs: RecentPr[]; exercisesWithoutPr: string[];
  forms: Record<Form, number>; feelings: { exercise: string; counts: Partial<Record<Feeling, number>> }[];
  moods: { date: IsoDate; sessionName: string; mood: string }[];
}

export function blockReview(input: {
  block: BlockRange; today: IsoDate; plan: WeekPlan | null; sessions: Session[];
  cycleState: CycleState; perfs: Performance[]; journal: Journal;
}): BlockReview {
  const { block, today, plan, sessions, cycleState, perfs, journal } = input;
  const inBlock = (d: IsoDate): boolean => d >= block.start && d <= block.end;

  const dated = perfs
    .filter((p) => !p.isBaseline)
    .map((p) => ({ p, date: parseDateToIso(p.performanceDate) }))
    .filter((x): x is { p: Performance; date: IsoDate } => x.date !== null && inBlock(x.date) && x.date <= today);

  // Séances prévues : occurrences des semaines qui chevauchent le bloc, rognées à ses bornes.
  let planned = 0;
  let done = 0;
  let skipped = 0;
  let missed = 0;
  if (plan) {
    for (let monday = mondayOf(block.start); monday <= block.end; monday = addDays(monday, 7)) {
      // Semaine à venir : prévues seulement (rien n'est fait ni manqué).
      const sunday = addDays(monday, 6);
      const ref = today < monday ? monday : today < sunday ? today : sunday;
      const weekOver = today > sunday;
      for (const o of weekOccurrences(plan, sessions, cycleState, perfs, ref)) {
        if (!inBlock(o.date)) continue;
        planned += 1;
        if (o.status === 'done') done += 1;
        else if (o.status === 'skipped') skipped += 1;
        // Semaine passée : évaluée au dimanche, où « aujourd'hui » vaut encore ; non fait = manqué.
        else if (o.status === 'missed' || (weekOver && o.status === 'today')) missed += 1;
      }
    }
  }
  if (planned === 0) {
    // Pas de planning : séances faites = couples (jour, séance) distincts.
    done = new Set(dated.map((x) => `${x.date}|${x.p.sessionName}`)).size;
    planned = done;
  }

  const prs = latestPrs(perfs, Infinity).filter((pr) => inBlock(pr.date) && pr.date <= today);
  const prNames = new Set(prs.map((pr) => pr.exerciseName));
  const exercisesWithoutPr = [...new Set(dated.map((x) => x.p.exerciseName))]
    .filter((n) => !prNames.has(n))
    .sort((a, b) => a.localeCompare(b, 'fr'));

  const logs = journal.logs.filter((l) => inBlock(l.date));
  const forms: Record<Form, number> = { frais: 0, fatigue: 0 };
  const byExercise = new Map<string, Partial<Record<Feeling, number>>>();
  for (const l of logs) {
    if (l.form) forms[l.form] += 1;
    for (const e of l.exercises) {
      if (!e.feeling) continue;
      const counts = byExercise.get(e.name) ?? {};
      counts[e.feeling] = (counts[e.feeling] ?? 0) + 1;
      byExercise.set(e.name, counts);
    }
  }
  const feelings = [...byExercise]
    .map(([exercise, counts]) => ({ exercise, counts }))
    .sort((a, b) => a.exercise.localeCompare(b.exercise, 'fr'));
  const moods = logs
    .filter((l) => l.mood.trim() !== '')
    .map((l) => ({ date: l.date, sessionName: l.sessionName, mood: l.mood.trim() }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { sessionsDone: done, sessionsPlanned: planned, sessionsSkipped: skipped, sessionsMissed: missed, prs, exercisesWithoutPr, forms, feelings, moods };
}

/** Ressentis comptés, dans l'ordre fixe de `FEELINGS` (« Fatigué ×2, Motivé ×1 »). */
export function feelingCountsLabel(counts: Partial<Record<Feeling, number>>): string {
  return FEELINGS.flatMap((f) => (counts[f.id] ? [`${f.label} ×${String(counts[f.id])}`] : [])).join(', ');
}
