import { describe, expect, it } from 'vitest';
import type { Exercise, Performance, Session, Variant } from '@/domain/model';
import {
  type SerieEntry, type WorkoutState, canValidate, parseWorkoutState, recordsTable, startWorkout, toPerformanceInputs, workoutReducer,
} from '@/domain/workout';

const tng: Variant = { id: 'v-tng', exerciseId: 'bench', name: 'Touch and Go', isDefault: true };
const pause: Variant = { id: 'v-pause', exerciseId: 'bench', name: 'Pause', isDefault: false };
const ex = (id: string, name: string, variants: Variant[] = []): Exercise => ({
  id, name, description: '', muscleGroups: [], variants, isCustom: false, createdAt: '', coachNotes: '',
});
const bench = ex('bench', 'Développé couché', [tng, pause]);
const curl = ex('curl', 'Curl', []);
const exercises = [bench, curl];

const session: Session = {
  id: 's1', name: 'Haut A', createdAt: '', cycle: 'A',
  exercises: [{ exerciseId: 'bench', name: 'Développé couché', series: 3 }, { exerciseId: 'curl', name: 'Curl', series: 2 }],
};
const NOW = new Date(2026, 10, 23, 18, 30);
const AT = '2026-11-23T17:40:00.000Z';

const filled = (s: SerieEntry, reps: string, kg: string): SerieEntry => ({ ...s, reps, kg });

function fresh(): WorkoutState {
  return startWorkout(session, exercises, NOW);
}

describe('startWorkout', () => {
  it('builds empty series with default variant and RPE 9', () => {
    const w = fresh();
    expect(w).toMatchObject({ version: 2, sessionId: 's1', sessionName: 'Haut A', cycle: 'A', date: '2026-11-23', startedAt: NOW.toISOString() });
    expect(w.exercises.map((e) => [e.exerciseId, e.name, e.plannedSeries, e.series.length, e.stoppedEarly])).toEqual([
      ['bench', 'Développé couché', 3, 3, false],
      ['curl', 'Curl', 2, 2, false],
    ]);
    expect(w.exercises[0]?.series[0]).toEqual({ variantKey: 'v-tng', reps: '', kg: '', rpe: 9, target: null, validated: false, validatedAt: null });
    // Exercice sans variante : variante par défaut implicite.
    expect(w.exercises[1]?.series[0]?.variantKey).toBe('Touch and Go');
  });

  it('keeps an exercise missing from the catalog', () => {
    const w = startWorkout({ ...session, cycle: null, exercises: [{ exerciseId: 'gone', name: 'Ancien', series: 1 }] }, exercises, NOW);
    expect(w.cycle).toBeNull();
    expect(w.exercises[0]).toMatchObject({ exerciseId: 'gone', name: 'Ancien', series: [{ variantKey: 'Touch and Go' }] });
  });
});

describe('canValidate', () => {
  const base: SerieEntry = { variantKey: 'x', reps: '5', kg: '100', rpe: 9, target: null, validated: false, validatedAt: null };
  it('accepts integer reps ≥ 1, weight ≥ 0 and RPE 6–10', () => {
    expect(canValidate(base)).toBe(true);
    expect(canValidate({ ...base, kg: '0' })).toBe(true);
    expect(canValidate({ ...base, kg: '82,5', rpe: 6 })).toBe(true);
    expect(canValidate({ ...base, rpe: 10 })).toBe(true);
  });
  it('rejects invalid input', () => {
    expect(canValidate({ ...base, reps: '0' })).toBe(false);
    expect(canValidate({ ...base, reps: '' })).toBe(false);
    expect(canValidate({ ...base, reps: '2.5' })).toBe(false);
    expect(canValidate({ ...base, kg: '' })).toBe(false);
    expect(canValidate({ ...base, kg: '-1' })).toBe(false);
    expect(canValidate({ ...base, rpe: 5 })).toBe(false);
    expect(canValidate({ ...base, rpe: 11 })).toBe(false);
    expect(canValidate({ ...base, rpe: 8.5 })).toBe(false);
  });
});

describe('workoutReducer', () => {
  it('sets fields, validates, locks and unlocks a serie', () => {
    let w = fresh();
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 0, field: 'reps', value: '5' });
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 0, field: 'kg', value: '100' });
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 0, field: 'rpe', value: 8 });
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 0, field: 'variantKey', value: 'v-pause' });
    expect(w.exercises[0]?.series[0]).toMatchObject({ reps: '5', kg: '100', rpe: 8, variantKey: 'v-pause' });

    w = workoutReducer(w, { type: 'validate', ex: 0, serie: 0, at: AT });
    expect(w.exercises[0]?.series[0]).toMatchObject({ validated: true, validatedAt: AT });
    // Déjà validée : inchangée.
    expect(workoutReducer(w, { type: 'validate', ex: 0, serie: 0, at: 'later' })).toBe(w);
    // Série verrouillée : saisie ignorée.
    const locked = workoutReducer(w, { type: 'setField', ex: 0, serie: 0, field: 'reps', value: '9' });
    expect(locked).toBe(w);
    w = workoutReducer(w, { type: 'unlock', ex: 0, serie: 0 });
    expect(w.exercises[0]?.series[0]).toMatchObject({ validated: false, validatedAt: null });
    expect(workoutReducer(w, { type: 'unlock', ex: 0, serie: 0 })).toBe(w);
  });

  it('refuses to validate an invalid serie', () => {
    const w = fresh();
    expect(workoutReducer(w, { type: 'validate', ex: 0, serie: 0, at: AT })).toBe(w);
  });

  it('ignores out-of-range indexes', () => {
    const w = fresh();
    expect(workoutReducer(w, { type: 'validate', ex: 9, serie: 0, at: AT })).toBe(w);
    expect(workoutReducer(w, { type: 'unlock', ex: 0, serie: 9 })).toBe(w);
    expect(workoutReducer(w, { type: 'addSerie', ex: 9 })).toBe(w);
    expect(workoutReducer(w, { type: 'stopExercise', ex: 9 })).toBe(w);
    expect(workoutReducer(w, { type: 'removeExercise', ex: 9 })).toBe(w);
  });

  it('setTarget pre-fills reps, kg and the target variant', () => {
    let w = workoutReducer(fresh(), { type: 'setTarget', ex: 0, serie: 1, target: { reps: 6, weight: 92.5, variantKey: 'v-pause' } });
    expect(w.exercises[0]?.series[1]).toMatchObject({ target: { reps: 6, weight: 92.5 }, reps: '6', kg: '92.5', variantKey: 'v-pause' });
    // Premier record à R reps : poids inconnu, la saisie de poids est conservée.
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 2, field: 'kg', value: '70' });
    w = workoutReducer(w, { type: 'setTarget', ex: 0, serie: 2, target: { reps: 12, weight: null, variantKey: 'v-tng' } });
    expect(w.exercises[0]?.series[2]).toMatchObject({ target: { reps: 12, weight: null }, reps: '12', kg: '70', variantKey: 'v-tng' });
    w = workoutReducer(w, { type: 'setTarget', ex: 0, serie: 2, target: null });
    expect(w.exercises[0]?.series[2]).toMatchObject({ target: null, reps: '12', kg: '70' });
  });

  it('adds and removes series (validated series cannot be removed)', () => {
    let w = workoutReducer(fresh(), { type: 'setField', ex: 1, serie: 1, field: 'variantKey', value: 'Marteau' });
    w = workoutReducer(w, { type: 'addSerie', ex: 1 });
    expect(w.exercises[1]?.series).toHaveLength(3);
    expect(w.exercises[1]?.series[2]).toEqual({ variantKey: 'Marteau', reps: '', kg: '', rpe: 9, target: null, validated: false, validatedAt: null });
    w = workoutReducer(w, { type: 'removeSerie', ex: 1, serie: 0 });
    expect(w.exercises[1]?.series).toHaveLength(2);
    w = workoutReducer(w, { type: 'setField', ex: 1, serie: 0, field: 'reps', value: '10' });
    w = workoutReducer(w, { type: 'setField', ex: 1, serie: 0, field: 'kg', value: '14' });
    w = workoutReducer(w, { type: 'validate', ex: 1, serie: 0, at: AT });
    expect(workoutReducer(w, { type: 'removeSerie', ex: 1, serie: 0 })).toBe(w);
  });

  it('stopExercise ends the exercise early (modular series)', () => {
    let w = fresh();
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 0, field: 'reps', value: '5' });
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 0, field: 'kg', value: '100' });
    w = workoutReducer(w, { type: 'validate', ex: 0, serie: 0, at: AT });
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 1, field: 'reps', value: '4' });
    w = workoutReducer(w, { type: 'stopExercise', ex: 0 });
    expect(w.exercises[0]?.stoppedEarly).toBe(true);
    expect(w.exercises[0]?.plannedSeries).toBe(3);
    expect(w.exercises[0]?.series).toHaveLength(1);
    expect(w.exercises[0]?.series[0]?.validated).toBe(true);
    // Reprendre l'exercice : la série ajoutée annule l'arrêt.
    w = workoutReducer(w, { type: 'addSerie', ex: 0 });
    expect(w.exercises[0]?.stoppedEarly).toBe(false);
    expect(w.exercises[0]?.series[1]?.variantKey).toBe('v-tng');
  });

  it('stopExercise only removes trailing non-validated series', () => {
    let w = fresh();
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 1, field: 'reps', value: '5' });
    w = workoutReducer(w, { type: 'setField', ex: 0, serie: 1, field: 'kg', value: '100' });
    w = workoutReducer(w, { type: 'validate', ex: 0, serie: 1, at: AT });
    w = workoutReducer(w, { type: 'stopExercise', ex: 0 });
    expect(w.exercises[0]?.series.map((s) => s.validated)).toEqual([false, true]);
  });

  it('adds and removes exercises, sets the date', () => {
    let w = workoutReducer(fresh(), { type: 'addExercise', exercise: curl, series: 4 });
    expect(w.exercises[2]).toMatchObject({ exerciseId: 'curl', name: 'Curl', plannedSeries: 4, stoppedEarly: false });
    expect(w.exercises[2]?.series).toHaveLength(4);
    w = workoutReducer(w, { type: 'addExercise', exercise: bench });
    expect(w.exercises[3]?.series).toHaveLength(3);
    w = workoutReducer(w, { type: 'removeExercise', ex: 0 });
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['curl', 'curl', 'bench']);
    w = workoutReducer(w, { type: 'setDate', date: '2026-11-22' });
    expect(w.date).toBe('2026-11-22');
  });
});

describe('toPerformanceInputs', () => {
  it('maps validated series only, resolving variants', () => {
    let w = fresh();
    const b = w.exercises[0];
    const c = w.exercises[1];
    if (!b || !c) throw new Error('fixture');
    w = {
      ...w,
      exercises: [
        { ...b, series: [
          { ...filled(b.series[0] as SerieEntry, '5', '100'), validated: true },
          { ...filled(b.series[1] as SerieEntry, '6', '82,5'), variantKey: 'v-pause', rpe: 10, validated: true },
          filled(b.series[2] as SerieEntry, '7', '80'),
        ] },
        { ...c, series: [
          { ...filled(c.series[0] as SerieEntry, '12', '14'), variantKey: 'marteau', validated: true },
          { ...filled(c.series[1] as SerieEntry, '0', '14'), validated: true },
        ] },
        { exerciseId: 'gone', name: 'Ancien', plannedSeries: 1, stoppedEarly: false, series: [
          { variantKey: 'Pause', reps: '3', kg: '50', rpe: 9, target: null, validated: true, validatedAt: null },
        ] },
      ],
    };
    expect(toPerformanceInputs(w, exercises)).toEqual([
      { exerciseId: 'bench', exerciseName: 'Développé couché', sessionName: 'Haut A', reps: 5, weight: 100, rpe: 9,
        variantId: 'v-tng', variantName: 'Touch and Go', serieNumber: 1, performanceDate: '2026-11-23' },
      { exerciseId: 'bench', exerciseName: 'Développé couché', sessionName: 'Haut A', reps: 6, weight: 82.5, rpe: 10,
        variantId: 'v-pause', variantName: 'Pause', serieNumber: 2, performanceDate: '2026-11-23' },
      { exerciseId: 'curl', exerciseName: 'Curl', sessionName: 'Haut A', reps: 12, weight: 14, rpe: 9,
        variantId: null, variantName: 'marteau', serieNumber: 1, performanceDate: '2026-11-23' },
      { exerciseId: 'gone', exerciseName: 'Ancien', sessionName: 'Haut A', reps: 3, weight: 50, rpe: 9,
        variantId: null, variantName: 'Pause', serieNumber: 1, performanceDate: '2026-11-23' },
    ]);
  });
});

describe('recordsTable', () => {
  let seq = 0;
  const perf = (reps: number, weight: number | null, date: string, over: Partial<Performance> = {}): Performance => ({
    id: `p${String(++seq)}`, exerciseId: 'bench', exerciseName: 'Développé couché', sessionName: 'S', reps, weight, rpe: 8,
    variantId: 'v-tng', variantName: 'Touch and Go', serieNumber: 1, performanceDate: date, createdAt: null, ...over,
  });

  it('30 rows, best weight per reps, dominated cells hidden', () => {
    const perfs = [
      perf(5, 100, '2026-11-01'),
      perf(5, 95, '2026-11-02'),
      perf(6, 100, '2026-11-03', { rpe: 9 }), // domine 5 × 100
      perf(8, 90, '2026-11-04', { rpe: null }),
      perf(3, 120, '2026-11-05', { variantId: 'v-pause', variantName: 'Pause' }),
      perf(4, 130, '2026-11-05', { exerciseId: 'squat' }),
      perf(10, null, '2026-11-06'),
    ];
    const rows = recordsTable(perfs, 'bench', tng);
    expect(rows).toHaveLength(30);
    expect(rows.map((r) => r.reps)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(rows[4]).toEqual({ reps: 5, weight: null, rpe: null, date: null });
    expect(rows[5]).toEqual({ reps: 6, weight: 100, rpe: 9, date: '2026-11-03' });
    expect(rows[7]).toEqual({ reps: 8, weight: 90, rpe: null, date: '2026-11-04' });
    expect(rows[2]).toEqual({ reps: 3, weight: null, rpe: null, date: null });
    expect(rows[3]).toEqual({ reps: 4, weight: null, rpe: null, date: null });
    expect(rows[9]).toEqual({ reps: 10, weight: null, rpe: 8, date: '2026-11-06' });
    expect(recordsTable(perfs, 'bench', pause)[2]).toEqual({ reps: 3, weight: 120, rpe: 8, date: '2026-11-05' });
  });
});

describe('parseWorkoutState', () => {
  it('accepts a valid v2 state (JSON round trip)', () => {
    let w = workoutReducer(fresh(), { type: 'setTarget', ex: 0, serie: 0, target: { reps: 5, weight: 100, variantKey: 'v-tng' } });
    w = workoutReducer(w, { type: 'validate', ex: 0, serie: 0, at: AT });
    w = workoutReducer(w, { type: 'stopExercise', ex: 1 });
    const raw: unknown = JSON.parse(JSON.stringify(w));
    expect(parseWorkoutState(raw)).toEqual(w);
    expect(parseWorkoutState({ ...w, cycle: null })?.cycle).toBeNull();
  });

  it('rejects other versions and garbage', () => {
    const w = fresh();
    expect(parseWorkoutState({ ...w, version: 1 })).toBeNull();
    expect(parseWorkoutState(null)).toBeNull();
    expect(parseWorkoutState('x')).toBeNull();
    expect(parseWorkoutState([])).toBeNull();
    expect(parseWorkoutState({ ...w, cycle: 'C' })).toBeNull();
    expect(parseWorkoutState({ ...w, sessionId: 3 })).toBeNull();
    expect(parseWorkoutState({ ...w, exercises: 'x' })).toBeNull();
    expect(parseWorkoutState({ ...w, exercises: [null] })).toBeNull();
    const ex0 = w.exercises[0];
    if (!ex0) throw new Error('fixture');
    const withSerie = (serie: unknown): unknown => ({ ...w, exercises: [{ ...ex0, series: [serie] }] });
    const s0 = ex0.series[0];
    expect(parseWorkoutState({ ...w, exercises: [{ ...ex0, stoppedEarly: 'no' }] })).toBeNull();
    expect(parseWorkoutState({ ...w, exercises: [{ ...ex0, series: 'x' }] })).toBeNull();
    expect(parseWorkoutState(withSerie(null))).toBeNull();
    expect(parseWorkoutState(withSerie({ ...s0, rpe: '9' }))).toBeNull();
    expect(parseWorkoutState(withSerie({ ...s0, validatedAt: 3 }))).toBeNull();
    expect(parseWorkoutState(withSerie({ ...s0, target: { reps: 5 } }))).toBeNull();
    expect(parseWorkoutState(withSerie({ ...s0, target: 'x' }))).toBeNull();
    expect(parseWorkoutState(withSerie({ ...s0, target: { reps: 5, weight: null } }))).not.toBeNull();
  });
});
