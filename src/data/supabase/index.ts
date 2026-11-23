import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataBackend } from '../ports';
import { createAdviceRepo } from './advice.repo';
import { asDb } from './client';
import { createCoachNotesRepo } from './coachNotes.repo';
import { createExercisesRepo } from './exercises.repo';
import { createPerformancesRepo } from './performances.repo';
import { createSessionsRepo } from './sessions.repo';
import { createSharedRepo } from './shared.repo';

export function createSupabaseBackend(client: SupabaseClient): DataBackend {
  const db = asDb(client);
  const coachNotes = createCoachNotesRepo(db);
  return {
    kind: 'supabase',
    exercises: createExercisesRepo(db, coachNotes),
    sessions: createSessionsRepo(db),
    performances: createPerformancesRepo(db),
    coachNotes,
    shared: createSharedRepo(db),
    advice: createAdviceRepo(db),
  };
}
