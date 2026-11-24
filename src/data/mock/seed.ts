import type { Id, IsoDateTime, Variant } from '../../domain/model';
import { DEFAULT_VARIANT, normalizeVariants } from '../../domain/variants';
import type { MockDb } from './db';

/** Variantes normalisées avec ids générés (le mock renvoie toujours des ids réels). */
export function withVariantIds(list: unknown, exerciseId: Id, genId: (prefix: string) => Id): Variant[] {
  return normalizeVariants(list, exerciseId).map((v) => ({ ...v, id: v.id ?? genId('variant'), exerciseId }));
}

const SESSION = 'Séance test (mock)';
const DESCRIPTION = 'Exercice de test (mock).';

/** Seed INV §4 : 2 exercices, 1 séance, 5 perfs (record reps, PR hybride, PR same-reps). */
export function buildSeed(genId: (prefix: string) => Id, createdAt: IsoDateTime): MockDb {
  const benchId = genId('exercise');
  const squatId = genId('exercise');
  const benchVariants = withVariantIds([{ name: DEFAULT_VARIANT, isDefault: true }, { name: 'Pause' }], benchId, genId);
  const squatVariants = withVariantIds([{ name: DEFAULT_VARIANT, isDefault: true }], squatId, genId);
  const sessionId = genId('session');

  const perf = (exerciseId: Id, exerciseName: string, variant: Variant | undefined, reps: number, weight: number, rpe: number, serie: number, date: string) => ({
    id: genId('perf'),
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    session_name: SESSION,
    reps,
    weight,
    rpe,
    variant_id: variant?.id ?? null,
    variant_name: variant?.name ?? DEFAULT_VARIANT,
    series_number: serie,
    performance_date: date,
    created_at: createdAt,
  });

  return {
    version: 2,
    createdAt,
    updatedAt: createdAt,
    exercises: [
      { id: benchId, name: 'Développé couché', description: DESCRIPTION, muscleGroups: ['Pectoraux', 'Triceps'], variants: benchVariants, isCustom: true, createdAt },
      { id: squatId, name: 'Squat', description: DESCRIPTION, muscleGroups: ['Quadriceps', 'Fessiers'], variants: squatVariants, isCustom: true, createdAt },
    ],
    sessions: [{ id: sessionId, name: SESSION, createdAt, cycle: 'A' }],
    sessionExercises: [
      { sessionId, exerciseId: benchId, seriesCount: 3 },
      { sessionId, exerciseId: squatId, seriesCount: 3 },
    ],
    performances: [
      perf(benchId, 'Développé couché', benchVariants[0], 5, 90, 9, 1, '2026-03-01'),
      perf(benchId, 'Développé couché', benchVariants[0], 6, 90, 9, 1, '2026-03-05'),
      perf(benchId, 'Développé couché', benchVariants[0], 6, 92.5, 9.5, 2, '2026-03-10'),
      perf(squatId, 'Squat', squatVariants[0], 5, 120, 9, 1, '2026-03-01'),
      perf(squatId, 'Squat', squatVariants[0], 5, 122.5, 9, 1, '2026-03-10'),
    ],
    coachNotesByExerciseId: {},
    generalAdvice: null,
    cycleState: null,
    weekPlan: null,
  };
}
