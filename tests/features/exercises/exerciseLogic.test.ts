import type { Exercise, Performance, Session } from '../../../src/domain/model';
import {
  createDraft,
  cyclesFor,
  draftWith,
  filterExercises,
  formatKg,
  newVariant,
  variantMeta,
  variantNameError,
  variantStats,
  worksMuscle,
} from '../../../src/features/exercises/exerciseLogic';

const ex = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'e1',
  name: 'Curl',
  description: 'd',
  muscleGroups: ['Biceps'],
  variants: [
    { id: 'v1', exerciseId: 'e1', name: 'Touch and Go', isDefault: true },
    { id: 'v2', exerciseId: 'e1', name: 'Pausé', isDefault: false },
  ],
  isCustom: true,
  createdAt: '2026-01-01T00:00:00Z',
  coachNotes: '',
  ...over,
});

const session = (id: string, cycle: Session['cycle'], ids: string[]): Session => ({
  id,
  name: id,
  createdAt: '',
  cycle,
  exercises: ids.map((exerciseId) => ({ exerciseId, name: exerciseId, series: 3 })),
});

const perf = (over: Partial<Performance>): Performance => ({
  id: Math.random().toString(),
  exerciseId: 'e1',
  exerciseName: 'Curl',
  sessionName: 'S',
  reps: 5,
  weight: 20,
  rpe: 9,
  variantId: 'v1',
  variantName: 'Touch and Go',
  serieNumber: 1,
  performanceDate: '2026-03-01',
  createdAt: null,
  ...over,
});

describe('cyclesFor', () => {
  it('returns A and B when the exercise is in both cycles, sorted', () => {
    const sessions = [session('b1', 'B', ['e1']), session('a1', 'A', ['e1', 'e2']), session('n', null, ['e1'])];
    expect(cyclesFor('e1', sessions)).toEqual(['A', 'B']);
    expect(cyclesFor('e2', sessions)).toEqual(['A']);
    expect(cyclesFor('e3', sessions)).toEqual([]);
  });
});

describe('filterExercises', () => {
  const list = [
    ex({ id: '1', name: 'Développé couché', muscleGroups: ['Pectoraux', 'Triceps'] }),
    ex({ id: '2', name: 'Squat', muscleGroups: ['Quadriceps'] }),
    ex({ id: '3', name: 'Élévations', muscleGroups: ['Épaules'] }),
  ];
  it('is accent-insensitive', () => {
    expect(filterExercises(list, 'developpe', null).map((e) => e.id)).toEqual(['1']);
    expect(filterExercises(list, 'elevations', null).map((e) => e.id)).toEqual(['3']);
  });
  it('matches muscle aliases', () => {
    expect(filterExercises(list, 'pecs', null).map((e) => e.id)).toEqual(['1']);
    expect(filterExercises(list, 'quads', null).map((e) => e.id)).toEqual(['2']);
  });
  it('applies the muscle filter after the search (Pectoraux is filtered by Pecs)', () => {
    expect(filterExercises(list, '', 'Pecs').map((e) => e.id)).toEqual(['1']);
    expect(filterExercises(list, 'squat', 'Pecs')).toEqual([]);
    expect(filterExercises(list, '', null)).toHaveLength(3);
  });
  it('worksMuscle compares exact labels for unknown muscles', () => {
    expect(worksMuscle({ muscleGroups: ['Cou'] }, 'cou')).toBe(true);
    expect(worksMuscle({ muscleGroups: ['Cou'] }, 'Psoas')).toBe(false);
  });
});

describe('variantStats', () => {
  it('computes best e1RM and record count per variant', () => {
    const perfs = [
      perf({ reps: 5, weight: 20 }),
      perf({ reps: 6, weight: 18 }),
      perf({ reps: 3, weight: 15 }), // dominée par 5 × 20
      perf({ variantId: 'v2', variantName: 'Pausé', reps: 10, weight: 15 }),
      perf({ exerciseId: 'other', reps: 1, weight: 200 }),
    ];
    const [classic, paused] = variantStats(ex(), perfs);
    expect(classic?.label).toBe('Classique');
    expect(classic?.records).toBe(2);
    expect(classic?.bestE1rm).toBe(23.3); // 20 × (1 + 5/30)
    expect(paused?.bestE1rm).toBe(20);
    expect(paused?.records).toBe(1);
  });
  it('returns null e1RM without performances', () => {
    const [classic] = variantStats(ex(), []);
    expect(classic?.bestE1rm).toBeNull();
    expect(classic && variantMeta(classic)).toBe('Par défaut · Aucun record');
  });
});

describe('variant names (D11)', () => {
  const variants = ex().variants;
  it('refuses empty and duplicate names, case/accents insensitive', () => {
    expect(variantNameError('  ', variants)).toBe('Donne un nom à la variante.');
    expect(variantNameError('pause', variants)).toBe('Une variante porte déjà ce nom.');
    expect(variantNameError('Classique', variants)).toBe('Une variante porte déjà ce nom.');
    expect(variantNameError('touch and go', variants)).toBe('Une variante porte déjà ce nom.');
    expect(variantNameError('Tempo', variants)).toBeNull();
  });
  it('ignores the renamed variant itself', () => {
    expect(variantNameError('Pausé', variants, 1)).toBeNull();
    expect(variantNameError('Classique', variants, 1)).toBe('Une variante porte déjà ce nom.');
  });
});

describe('drafts and formatting', () => {
  it('builds drafts', () => {
    const e = ex();
    const v = newVariant(e, '  Tempo ');
    expect(v).toEqual({ id: null, exerciseId: 'e1', name: 'Tempo', isDefault: false });
    expect(draftWith(e, [v])).toEqual({ name: 'Curl', description: 'd', muscleGroups: ['Biceps'], variants: [v] });
    expect(createDraft(' Row ', ['Grand dorsal']).variants[0]).toMatchObject({ name: 'Touch and Go', isDefault: true });
    expect(createDraft(' Row ', []).name).toBe('Row');
  });
  it('formats kg and meta', () => {
    expect(formatKg(27.5)).toBe('27,5 kg');
    expect(formatKg(null)).toBe('—');
    const stat = { variant: { id: 'v2', exerciseId: 'e1', name: 'Pausé', isDefault: false }, label: 'Pausé', records: 1, bestE1rm: null };
    expect(variantMeta(stat)).toBe('1 record');
    expect(variantMeta({ ...stat, records: 4 })).toBe('4 records');
  });
});
