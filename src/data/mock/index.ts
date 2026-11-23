import type { DataBackend } from '../ports';
import { createMockAdviceRepo } from './advice.repo';
import { createMockCoachNotesRepo } from './coachNotes.repo';
import { createMockCyclesRepo } from './cycles.repo';
import { createMockContext, task, type MockOptions } from './db';
import { createMockExercisesRepo } from './exercises.repo';
import { createMockPerformancesRepo } from './performances.repo';
import { createMockSessionsRepo } from './sessions.repo';

/** Backend local (localStorage), même contrat et mêmes validations que Supabase. Ne lève jamais `NetworkError`. */
export function createMockBackend(storage: Storage = localStorage, opts: MockOptions = {}): DataBackend {
  const ctx = createMockContext(storage, opts);
  return {
    kind: 'mock',
    exercises: createMockExercisesRepo(ctx),
    sessions: createMockSessionsRepo(ctx),
    performances: createMockPerformancesRepo(ctx),
    coachNotes: createMockCoachNotesRepo(ctx),
    advice: createMockAdviceRepo(ctx),
    cycles: createMockCyclesRepo(ctx),
    reset: () => task(() => {
      ctx.reset();
    }),
  };
}
