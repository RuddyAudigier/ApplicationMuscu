import { OFFLINE_QUEUE_CORRUPT_KEY, OFFLINE_QUEUE_FAILED_KEY, OFFLINE_QUEUE_KEY } from '../offlineQueue';
import type { DataBackend } from '../ports';
import { createMockAdviceRepo } from './advice.repo';
import { createMockCoachNotesRepo } from './coachNotes.repo';
import { createMockCyclesRepo } from './cycles.repo';
import { createMockContext, task, type MockOptions } from './db';
import { createMockExercisesRepo } from './exercises.repo';
import { createMockPerformancesRepo } from './performances.repo';
import { createMockSessionsRepo } from './sessions.repo';

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
    /** Remet le seed ET vide la file hors-ligne et ses archives : en démo, rien de réel n'y est perdu. */
    reset: () => task(() => {
      ctx.reset();
      for (const key of [OFFLINE_QUEUE_KEY, OFFLINE_QUEUE_FAILED_KEY, OFFLINE_QUEUE_CORRUPT_KEY]) storage.removeItem(key);
    }),
  };
}
