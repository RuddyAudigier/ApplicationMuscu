import { describe, expect, it } from 'vitest';
import type { Exercise, Performance, Variant } from '@/domain/model';
import { buildReport } from '@/domain/report';
import type { SerieEntry, WorkoutExercise, WorkoutState } from '@/domain/workout';

const tng: Variant = { id: 'v-tng', exerciseId: 'bench', name: 'Touch and Go', isDefault: true };
const pause: Variant = { id: 'v-pause', exerciseId: 'bench', name: 'Pause', isDefault: false };
const bench: Exercise = {
  id: 'bench', name: 'Développé couché', description: '', muscleGroups: [], variants: [tng, pause],
  isCustom: false, createdAt: '', coachNotes: '',
};
const exercises = [bench];

const START = new Date(2026, 10, 23, 18, 0);
const serie = (reps: number, kg: number, over: Partial<SerieEntry> = {}): SerieEntry => ({
  variantKey: 'v-tng', reps: String(reps), kg: String(kg), rpe: 9, target: null, validated: true, validatedAt: null, ...over,
});
const wex = (series: SerieEntry[], over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  exerciseId: 'bench', name: 'Développé couché', plannedSeries: 3, stoppedEarly: false, series, ...over,
});
const state = (exs: WorkoutExercise[], over: Partial<WorkoutState> = {}): WorkoutState => ({
  version: 2, sessionId: 's1', sessionName: 'Haut A', cycle: 'A', date: '2026-11-23', startedAt: START.toISOString(),
  exercises: exs, ...over,
});

let seq = 0;
const hist = (reps: number, weight: number, date: string, over: Partial<Performance> = {}): Performance => ({
  id: `h${String(++seq)}`, exerciseId: 'bench', exerciseName: 'Développé couché', sessionName: 'Haut A', reps, weight,
  rpe: 9, variantId: 'v-tng', variantName: 'Touch and Go', serieNumber: 1, performanceDate: date, createdAt: null, ...over,
});

const END = new Date(2026, 10, 23, 19, 12, 20);

describe('buildReport', () => {
  it('summary: title, cycle, date, duration, counts', () => {
    const r = buildReport(state([wex([serie(5, 100), serie(5, 100, { validated: false })], { stoppedEarly: true })]), [], exercises, END);
    expect(r).toMatchObject({
      title: 'Haut A', cycle: 'A', date: '2026-11-23', durationMin: 72, prCount: 0, seriesCount: 1, exerciseCount: 1,
    });
    expect(r.exercises).toEqual([{
      name: 'Développé couché',
      seriesLabel: '1 série · fatigué',
      series: [{ n: 1, variant: 'Classique', reps: 5, weight: 100, rpe: 9, isPr: false, prKind: null }],
    }]);
  });

  it('4 × 100 after 3 × 100 is a reps PR', () => {
    const r = buildReport(state([wex([serie(4, 100)])]), [hist(3, 100, '2026-11-10')], exercises, END);
    expect(r.prCount).toBe(1);
    expect(r.exercises[0]?.series[0]).toMatchObject({ isPr: true, prKind: 'reps' });
  });

  it('3 × 100 after 4 × 100 is not a PR', () => {
    const r = buildReport(state([wex([serie(3, 100)])]), [hist(4, 100, '2026-11-10')], exercises, END);
    expect(r.prCount).toBe(0);
    expect(r.exercises[0]?.series[0]).toMatchObject({ isPr: false, prKind: null });
  });

  it('charge and hybrid PR kinds; separate records per variant', () => {
    const history = [hist(5, 100, '2026-11-10'), hist(3, 80, '2026-11-10', { variantId: 'v-pause', variantName: 'Pause' })];
    const r = buildReport(state([wex([
      serie(5, 102.5),
      serie(6, 105),
      serie(3, 80, { variantKey: 'v-pause' }),
    ])]), history, exercises, END);
    expect(r.exercises[0]?.series.map((s) => [s.variant, s.prKind])).toEqual([
      ['Classique', 'charge'],
      ['Classique', 'hybride'],
      ['Pause', null],
    ]);
    expect(r.prCount).toBe(2);
    expect(r.exercises[0]?.seriesLabel).toBe('3 séries');
  });

  it('earlier series of the same workout count as history', () => {
    const r = buildReport(state([wex([serie(5, 100), serie(5, 100), serie(5, 102)])]), [hist(5, 90, '2026-11-01')], exercises, END);
    expect(r.exercises[0]?.series.map((s) => s.prKind)).toEqual(['charge', null, 'charge']);
    // Premier essai sans historique : pas de PR (capture de données).
    const first = buildReport(state([wex([serie(5, 100), serie(6, 100)])]), [], exercises, END);
    expect(first.exercises[0]?.series.map((s) => s.prKind)).toEqual([null, 'reps']);
  });

  it('works when the workout date was moved to another day', () => {
    const r = buildReport(
      state([wex([serie(5, 100), serie(6, 100)])], { date: '2026-11-21' }),
      [hist(5, 95, '2026-11-20'), hist(5, 200, '2026-11-22')],
      exercises,
      END,
    );
    expect(r.date).toBe('2026-11-21');
    expect(r.exercises[0]?.series.map((s) => s.prKind)).toEqual(['charge', 'reps']);
  });

  it('processes series in real validation order (validatedAt), document order as fallback', () => {
    const at = (min: number): string => new Date(START.getTime() + min * 60_000).toISOString();
    // S2 (5 × 100) validée avant S1 (5 × 102) : les deux sont des PR charge, S3 non validée-horodatée vient après.
    const r = buildReport(state([wex([
      serie(5, 102, { validatedAt: at(10) }),
      serie(5, 100, { validatedAt: at(5) }),
      serie(5, 101),
    ])]), [hist(5, 90, '2026-11-01')], exercises, END);
    expect(r.exercises[0]?.series.map((s) => [s.n, s.prKind])).toEqual([[1, 'charge'], [2, 'charge'], [3, null]]);
    // Ordre réel inverse : 5 × 102 d'abord, puis 5 × 100 n'est plus un PR.
    const r2 = buildReport(state([wex([
      serie(5, 100, { validatedAt: at(10) }),
      serie(5, 102, { validatedAt: at(5) }),
    ])]), [hist(5, 90, '2026-11-01')], exercises, END);
    expect(r2.exercises[0]?.series.map((s) => s.prKind)).toEqual([null, 'charge']);
  });

  it('same-day history rows count only if recorded before the workout started', () => {
    const local = (d: number, h: number): string => new Date(2026, 10, d, h).toISOString();
    const history = [
      hist(5, 100, '2026-11-23', { createdAt: local(23, 17) }),
      hist(6, 200, '2026-11-23', { createdAt: local(23, 19) }),
    ];
    const r = buildReport(state([wex([serie(6, 100)])]), history, exercises, END);
    expect(r.exercises[0]?.series[0]?.prKind).toBe('reps');
  });

  it('moved to an earlier day: that day rows (with createdAt) are history', () => {
    const local = (d: number, h: number): string => new Date(2026, 10, d, h).toISOString();
    const r = buildReport(
      state([wex([serie(6, 100), serie(6, 100)])], { date: '2026-11-21' }),
      [hist(5, 100, '2026-11-21', { createdAt: local(21, 20) })],
      exercises,
      END,
    );
    expect(r.exercises[0]?.series.map((s) => s.prKind)).toEqual(['reps', null]);
  });

  it('moved to a later day: rows of that day recorded after the start are ignored', () => {
    const local = (d: number, h: number): string => new Date(2026, 10, d, h).toISOString();
    const r = buildReport(
      state([wex([serie(5, 100)])], { date: '2026-11-25' }),
      [hist(5, 90, '2026-11-20'), hist(5, 150, '2026-11-25', { createdAt: local(25, 8) }), hist(5, 999, 'garbage')],
      exercises,
      END,
    );
    expect(r.exercises[0]?.series[0]?.prKind).toBe('charge');
  });

  it('skips exercises without validated series and invalid series', () => {
    const r = buildReport(state([
      wex([serie(5, 100, { validated: false })]),
      wex([serie(0, 100), serie(8, 60, { kg: '' }), serie(10, 20, { rpe: 7, variantKey: 'Touch and Go' })], { exerciseId: 'gone', name: 'Ancien' }),
    ], { cycle: null }), [], exercises, new Date(START.getTime() - 60_000));
    expect(r).toMatchObject({ cycle: null, durationMin: 0, seriesCount: 1, exerciseCount: 1 });
    expect(r.exercises).toEqual([{
      name: 'Ancien', seriesLabel: '1 série',
      series: [{ n: 3, variant: 'Classique', reps: 10, weight: 20, rpe: 7, isPr: false, prKind: null }],
    }]);
  });

  it('defaults the end time to now', () => {
    const r = buildReport(state([]), [], exercises);
    expect(r.durationMin).toBeGreaterThanOrEqual(0);
    expect(r.exercises).toEqual([]);
  });
});
