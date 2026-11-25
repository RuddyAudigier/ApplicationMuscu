import { parseDateToIso, performanceTimestamp, todayIso } from './dates';
import { toWarmupSets, type Feeling, type Form, type WarmupSet } from './journal';
import type { CycleId, Exercise, Id, IsoDate, Performance } from './model';
import { parseReps, parseWeight } from './numbers';
import { buildHistoryIndex, classify, findPreviousBest } from './records';
import { variantLabel } from './variants';
import { type WorkoutState, canValidate, resolveVariant } from './workout';

type PrKind = 'charge' | 'reps' | 'hybride';
interface ReportSerie {
  n: number; variant: string; reps: number; weight: number; rpe: number; isPr: boolean; prKind: PrKind | null;
}
export interface ReportExercise { exerciseId: Id; name: string; seriesLabel: string; feeling: Feeling | null; series: ReportSerie[];
  /** Séries de chauffe valides (hors PR, hors performances). */
  warmupSets: WarmupSet[];
}
export interface Report {
  title: string; cycle: CycleId | null; date: IsoDate; durationMin: number;
  prCount: number; seriesCount: number; exerciseCount: number; exercises: ReportExercise[];
  /** Compte rendu du journal lié (`null` tant que non créé). */
  logId: string | null;
  form: Form | null;
  mood: string;
  /** Échauffement général fait. */
  warmup: { name: string; detail: string }[];
}

interface Pending {
  exIndex: number; n: number; rpe: number; order: number; perf: Omit<Performance, 'createdAt'>;
}

const seriesLabel = (count: number, stoppedEarly: boolean): string =>
  `${String(count)} ${count > 1 ? 'séries' : 'série'}${stoppedEarly ? ' · fatigué' : ''}`;

const localMidnight = (iso: IsoDate): number => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/**
 * Compte rendu de fin de séance.
 *
 * - Les séries validées sont traitées dans l'ordre réel de validation (`validatedAt`), à défaut
 *   dans l'ordre de la séance ; chacune est comparée à l'historique + aux séries précédentes.
 * - Début de séance W = min(`startedAt`, premier `validatedAt`). Une ligne d'historique compte si
 *   sa date est antérieure à `state.date`, ou si elle est du même jour avec un horodatage < W.
 *
 * Précondition stricte : `history` ne doit PAS contenir les performances de cette séance
 * (l'appelant les filtre) ; aucune marque ne permet de les reconnaître ici.
 */
export function buildReport(state: WorkoutState, history: Performance[], exercises: Exercise[], now: Date = new Date()): Report {
  const start = Date.parse(state.startedAt);

  const pending: Pending[] = [];
  state.exercises.forEach((we, exIndex) => {
    const exercise = exercises.find((e) => e.id === we.exerciseId);
    we.series.forEach((s, i) => {
      if (!s.validated || !canValidate(s)) return;
      const validatedAt = s.validatedAt === null ? Number.NaN : Date.parse(s.validatedAt);
      pending.push({
        exIndex, n: i + 1, rpe: s.rpe, order: Number.isFinite(validatedAt) ? validatedAt : Number.POSITIVE_INFINITY,
        perf: {
          id: `report-${String(pending.length)}`,
          exerciseId: we.exerciseId,
          exerciseName: exercise?.name ?? we.name,
          sessionName: state.sessionName,
          reps: parseReps(s.reps) ?? 0,
          weight: parseWeight(s.kg) ?? 0,
          rpe: s.rpe,
          ...resolveVariant(exercise, s.variantKey),
          serieNumber: i + 1,
          performanceDate: state.date,
        },
      });
    });
  });
  // Tri stable : ordre de validation, puis ordre de la séance.
  pending.sort((a, b) => a.order - b.order);

  const workoutStart = Math.min(...[start, ...pending.map((p) => p.order)].filter(Number.isFinite));
  const before: Performance[] = [];
  let latest = Number.NEGATIVE_INFINITY;
  for (const h of history) {
    const day = parseDateToIso(h.performanceDate);
    const ts = performanceTimestamp(h);
    if (day === null || ts === null) continue;
    if (day < state.date || (day === state.date && ts < workoutStart)) {
      before.push(h);
      latest = Math.max(latest, ts);
    }
  }
  // Horodatages des séries : strictement après tout l'historique retenu, dans le jour de la séance.
  const midnight = localMidnight(state.date);
  const startSameDay = todayIso(new Date(workoutStart)) === state.date ? workoutStart : midnight;
  const base = Math.max(midnight, startSameDay, latest + 1);
  const dated = pending.map((p, k) => {
    const at = base + k + 1;
    return { ...p, at, perf: { ...p.perf, createdAt: new Date(at).toISOString() } };
  });

  // Un seul index : le filtre `timestamp < atTimestamp` ne garde que les séries antérieures.
  const index = buildHistoryIndex([...before, ...dated.map((p) => p.perf)]);
  const byExercise = new Map<number, ReportSerie[]>();
  let prCount = 0;
  for (const p of dated) {
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
    const series = byExercise.get(exIndex) ?? [];
    const warmupSets = toWarmupSets(we.warmupSets);
    // Même règle que `logFromWorkout` : séries validées, chauffe valide ou ressenti (échauffement seul : « 0 série »).
    if (series.length === 0 && warmupSets.length === 0 && we.feeling === null) return;
    const name = exercises.find((e) => e.id === we.exerciseId)?.name ?? we.name;
    reportExercises.push({ exerciseId: we.exerciseId, name, seriesLabel: seriesLabel(series.length, we.stoppedEarly), feeling: we.feeling, series: series.sort((x, y) => x.n - y.n), warmupSets });
  });

  return {
    title: state.sessionName,
    cycle: state.cycle,
    date: state.date,
    durationMin: Number.isFinite(start) ? Math.max(0, Math.round((now.getTime() - start) / 60_000)) : 0,
    prCount,
    seriesCount: pending.length,
    exerciseCount: reportExercises.length,
    exercises: reportExercises,
    logId: null,
    form: state.form,
    mood: state.mood,
    warmup: state.warmup.filter((w) => w.done).map((w) => ({ name: w.name, detail: w.detail })),
  };
}
