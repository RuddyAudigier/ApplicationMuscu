import type { DataBackend } from '../ports';
import { createMockAdviceRepo } from './advice.repo';
import { createMockCoachNotesRepo } from './coachNotes.repo';
import { createMockContext, task, type MockOptions } from './db';
import { createMockExercisesRepo } from './exercises.repo';
import { createMockPerformancesRepo } from './performances.repo';
import { createMockSessionsRepo } from './sessions.repo';
import { createMockSharedRepo } from './shared.repo';

/** Backend local (localStorage), même contrat et mêmes validations que Supabase. Ne lève jamais `NetworkError`. */
export function createMockBackend(storage: Storage = localStorage, opts: MockOptions = {}): DataBackend {
  const ctx = createMockContext(storage, opts);
  return {
    kind: 'mock',
    exercises: createMockExercisesRepo(ctx),
    sessions: createMockSessionsRepo(ctx),
    performances: createMockPerformancesRepo(ctx),
    coachNotes: createMockCoachNotesRepo(ctx),
    shared: createMockSharedRepo(ctx),
    advice: createMockAdviceRepo(ctx),
    reset: () => task(() => {
      ctx.reset();
    }),
  };
}
