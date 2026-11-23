import { performanceTimestamp } from './dates';
import type { CycleId, Exercise, IsoDate, Performance } from './model';
import { parseReps, parseWeight } from './numbers';
import { buildHistoryIndex, classify, findPreviousBest } from './records';
import { variantLabel } from './variants';
import { type WorkoutState, canValidate, resolveVariant } from './workout';

type PrKind = 'charge' | 'reps' | 'hybride';
interface ReportSerie {
  n: number; variant: string; reps: number; weight: number; rpe: number; isPr: boolean; prKind: PrKind | null;
}
interface ReportExercise { name: string; seriesLabel: string; series: ReportSerie[] }
export interface Report {
  title: string; cycle: CycleId | null; date: IsoDate; durationMin: number;
  prCount: number; seriesCount: number; exerciseCount: number; exercises: ReportExercise[];
}

interface Pending {
  exIndex: number; n: number; rpe: number; at: number; perf: Performance;
}

const seriesLabel = (count: number, stoppedEarly: boolean): string =>
  `${String(count)} ${count > 1 ? 'séries' : 'série'}${stoppedEarly ? ' · fatigué' : ''}`;

/**
 * Compte rendu de fin de séance. Les séries validées sont traitées dans l'ordre de la séance ;
 * chacune est comparée à l'historique + aux séries précédentes de la séance (horodatages
 * strictement croissants à partir du début de séance, ramené au jour de la séance).
 * `history` ne doit pas contenir les performances de cette séance déjà enregistrées.
 */
export function buildReport(state: WorkoutState, history: Performance[], exercises: Exercise[], now: Date = new Date()): Report {
  const start = Date.parse(state.startedAt);
  const base = performanceTimestamp({ performanceDate: state.date, createdAt: state.startedAt }) ?? start;

  const pending: Pending[] = [];
  state.exercises.forEach((we, exIndex) => {
    const exercise = exercises.find((e) => e.id === we.exerciseId);
    we.series.forEach((s, i) => {
      if (!s.validated || !canValidate(s)) return;
      const at = base + pending.length + 1;
      pending.push({
        exIndex, n: i + 1, rpe: s.rpe, at,
        perf: {
          id: `report-${String(at)}`,
          exerciseId: we.exerciseId,
          exerciseName: exercise?.name ?? we.name,
          sessionName: state.sessionName,
          reps: parseReps(s.reps) ?? 0,
          weight: parseWeight(s.kg) ?? 0,
          rpe: s.rpe,
          ...resolveVariant(exercise, s.variantKey),
          serieNumber: i + 1,
          performanceDate: state.date,
          createdAt: new Date(at).toISOString(),
        },
      });
    });
  });

  // Un seul index : le filtre `timestamp < atTimestamp` ne garde que les séries antérieures.
  const index = buildHistoryIndex([...history, ...pending.map((p) => p.perf)]);
  const byExercise = new Map<number, ReportSerie[]>();
  let prCount = 0;
  for (const p of pending) {
    const weight = p.perf.weight ?? 0;
    const ref = findPreviousBest(index, p.perf.exerciseId, p.perf, { atTimestamp: p.at });
    const c = classify({ reps: p.perf.reps, weight }, ref);
    const isPr = c.improvementStatus === 'improved';
    const prKind: PrKind | null = !isPr ? null : c.isHybridPr ? 'hybride' : c.isRepsPr ? 'reps' : 'charge';
    if (isPr) prCount += 1;
    const list = byExercise.get(p.exIndex) ?? [];
    list.push({ n: p.n, variant: variantLabel(p.perf.variantName), reps: p.perf.reps, weight, rpe: p.rpe, isPr, prKind });
    byExercise.set(p.exIndex, list);
  }

  const reportExercises: ReportExercise[] = [];
  state.exercises.forEach((we, exIndex) => {
    const series = byExercise.get(exIndex);
    if (!series) return;
    const name = exercises.find((e) => e.id === we.exerciseId)?.name ?? we.name;
    reportExercises.push({ name, seriesLabel: seriesLabel(series.length, we.stoppedEarly), series });
  });

  return {
    title: state.sessionName,
    cycle: state.cycle,
    date: state.date,
    durationMin: Math.max(0, Math.round((now.getTime() - start) / 60_000)),
    prCount,
    seriesCount: pending.length,
    exerciseCount: reportExercises.length,
    exercises: reportExercises,
  };
}
