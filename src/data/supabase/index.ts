import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataBackend } from '../ports';
import { createAdviceRepo } from './advice.repo';
import { asDb } from './client';
import { createCoachNotesRepo } from './coachNotes.repo';
import { createCycleFallback } from './cycleFallback';
import { createCyclesRepo } from './cycles.repo';
import { createExercisesRepo } from './exercises.repo';
import { createPerformancesRepo } from './performances.repo';
import { createSessionsRepo } from './sessions.repo';
import { createWeekPlanRepo } from './weekPlan.repo';
import { createJournalRepo } from './journal.repo';

/** `storage` : repli local des cycles si la migration 2026-11-23 n'est pas jouée. */
export function createSupabaseBackend(client: SupabaseClient, storage: Storage = localStorage): DataBackend {
  const db = asDb(client);
  const coachNotes = createCoachNotesRepo(db);
  const cycleFallback = createCycleFallback(storage);
  return {
    kind: 'supabase',
    exercises: createExercisesRepo(db, coachNotes),
    sessions: createSessionsRepo(db, cycleFallback),
    performances: createPerformancesRepo(db),
    coachNotes,
    advice: createAdviceRepo(db),
    cycles: createCyclesRepo(db, cycleFallback),
    weekPlan: createWeekPlanRepo(db, storage),
    journal: createJournalRepo(db, storage),
  };
}
