import { MOCK_QUEUE_KEYS } from '../offlineQueue';
import type { DataBackend } from '../ports';
import { createMockAdviceRepo } from './advice.repo';
import { createMockCoachNotesRepo } from './coachNotes.repo';
import { createMockCyclesRepo } from './cycles.repo';
import { createMockContext, task, type MockOptions } from './db';
import { createMockExercisesRepo } from './exercises.repo';
import { createMockPerformancesRepo } from './performances.repo';
import { createMockSessionsRepo } from './sessions.repo';
import { createMockWeekPlanRepo } from './weekPlan.repo';

/**
 * Backend local (localStorage), même contrat et mêmes validations que Supabase.
 * Seul `performances.add` lève `NetworkError`, quand le navigateur est hors ligne (démo de la file D8).
 */
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
    weekPlan: createMockWeekPlanRepo(ctx),
    /** Remet le seed ET vide la file hors-ligne de démo (clés `mock:`) ; la vraie file n'est jamais touchée. */
    reset: () => task(() => {
      ctx.reset();
      for (const key of [MOCK_QUEUE_KEYS.queue, MOCK_QUEUE_KEYS.failed, MOCK_QUEUE_KEYS.corrupt]) storage.removeItem(key);
    }),
  };
}
