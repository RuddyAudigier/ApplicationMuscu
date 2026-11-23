import {
  mapAdviceRow, mapExerciseRow, mapPerformanceRow, mapSessionRow, mapVariantRow, parseRows, toPerformanceRow,
} from '../../src/data/supabase/mappers';
import type { PerformanceInput } from '../../src/domain/model';

const row = {
  id: 7, exercise_id: 'e1', exercise_name: 'Bench', session_name: 'S', reps: '5', weight: '62.5',
  variant_id: null, variant_name: null, series_number: 2, performance_date: '2026-03-01', created_at: '2026-03-01T10:00:00Z',
};

describe('mapPerformanceRow', () => {
  it('maps snake_case to the domain model with legacy defaults', () => {
    expect(mapPerformanceRow(row)).toEqual({
      id: '7', exerciseId: 'e1', exerciseName: 'Bench', sessionName: 'S', reps: 5, weight: 62.5, rpe: null,
      variantId: null, variantName: 'Touch and Go', serieNumber: 2, performanceDate: '2026-03-01', createdAt: '2026-03-01T10:00:00Z',
    });
  });

  it('rpe absent → null (never NaN); numeric rpe kept', () => {
    expect(mapPerformanceRow(row)?.rpe).toBeNull();
    expect(mapPerformanceRow({ ...row, rpe: null })?.rpe).toBeNull();
    expect(mapPerformanceRow({ ...row, rpe: '9.5' })?.rpe).toBe(9.5);
  });

  it('null weight, missing created_at, empty variant name', () => {
    const p = mapPerformanceRow({ ...row, weight: null, created_at: undefined, variant_name: '', variant_id: 'v1' });
    expect(p?.weight).toBeNull();
    expect(p?.createdAt).toBeNull();
    expect(p?.variantName).toBe('Touch and Go');
    expect(p?.variantId).toBe('v1');
  });

  it('rejects malformed rows', () => {
    expect(mapPerformanceRow(null)).toBeNull();
    expect(mapPerformanceRow({ ...row, reps: 'abc' })).toBeNull();
    expect(mapPerformanceRow({ ...row, performance_date: undefined })).toBeNull();
  });
});

describe('other mappers', () => {
  it('maps variants and exercises', () => {
    const v = mapVariantRow({ id: 'v1', exercise_id: 'e1', name: 'Pause', is_default: null });
    expect(v).toEqual({ id: 'v1', exerciseId: 'e1', name: 'Pause', isDefault: false });
    expect(mapVariantRow({ id: 1 })).toBeNull();
    const e = mapExerciseRow(
      { id: 'e1', name: 'Bench', description: null, muscle_groups: ['Pecs', 'pecs'], is_custom: null, created_at: '2026-01-01T00:00:00Z' },
      v ? [v] : [], 'note',
    );
    expect(e).toEqual({
      id: 'e1', name: 'Bench', description: '', muscleGroups: ['Pecs'], isCustom: true, createdAt: '2026-01-01T00:00:00Z',
      coachNotes: 'note', variants: [{ id: 'v1', exerciseId: 'e1', name: 'Pause', isDefault: true }],
    });
    expect(mapExerciseRow({ id: 'e2', name: 'X', muscle_groups: null, is_custom: false }, [], '')).toMatchObject({
      muscleGroups: [], isCustom: false, createdAt: '', variants: [{ name: 'Touch and Go', isDefault: true, id: null }],
    });
    expect(mapExerciseRow({ name: 'no id' }, [], '')).toBeNull();
  });

  it('maps sessions and skips nested rows whose exercise is null (D12)', () => {
    expect(mapSessionRow({
      id: 's1', name: 'Push', created_at: '2026-01-01T00:00:00Z',
      session_exercises: [
        { series_count: 3, exercise_id: 'e1', exercises: { name: 'Bench' } },
        { series_count: 2, exercise_id: 'e2', exercises: null },
        { series_count: '4', exercise_id: 'e3', exercises: [{ name: 'Dips' }] },
      ],
    })).toEqual({
      id: 's1', name: 'Push', createdAt: '2026-01-01T00:00:00Z',
      exercises: [{ exerciseId: 'e1', name: 'Bench', series: 3 }, { exerciseId: 'e3', name: 'Dips', series: 4 }],
    });
    expect(mapSessionRow({ id: 's2', name: 'Vide', created_at: 'x', session_exercises: null })?.exercises).toEqual([]);
    expect(mapSessionRow({ id: 's3' })).toBeNull();
  });

  it('maps advice', () => {
    expect(mapAdviceRow({ training_notes: 't', nutrition_notes: null, sleep_notes: 's' })).toEqual({ training: 't', nutrition: '', sleep: 's' });
    expect(mapAdviceRow(null)).toBeNull();
  });

  it('parseRows skips malformed rows and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseRows([row, { bad: 1 }, { bad: 2 }], mapPerformanceRow, 'performances')).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(parseRows(null, mapPerformanceRow, 'performances')).toEqual([]);
  });
});

describe('toPerformanceRow', () => {
  const input: PerformanceInput = {
    exerciseId: 'e1', exerciseName: 'Bench', sessionName: 'S', reps: 5, weight: 62.456, rpe: null,
    variantId: null, variantName: '', serieNumber: 1, performanceDate: '',
  };
  it('applies write defaults', () => {
    expect(toPerformanceRow(input, '2026-05-02')).toEqual({
      exercise_id: 'e1', exercise_name: 'Bench', session_name: 'S', reps: 5, weight: 62.46, rpe: 10,
      variant_id: null, variant_name: 'Touch and Go', series_number: 1, performance_date: '2026-05-02',
    });
    expect(toPerformanceRow({ ...input, rpe: 8, variantId: 'v', variantName: 'Pause', performanceDate: '2026-01-01' }, '2026-05-02'))
      .toMatchObject({ rpe: 8, variant_id: 'v', variant_name: 'Pause', performance_date: '2026-01-01' });
  });
});
