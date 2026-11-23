import type { Id } from '../../domain/model';
import { ValidationError, type CoachNotesRepo } from '../ports';
import { normalizeNotes } from '../shared/rules';
import { task, type MockContext } from './db';

export function createMockCoachNotesRepo(ctx: MockContext): CoachNotesRepo {
  return {
    listAll: () => task(() => {
      const out: Record<Id, string> = {};
      for (const [id, n] of Object.entries(ctx.read().coachNotesByExerciseId)) out[id] = n.notes;
      return out;
    }),
    save: (exerciseId, notes) => task(() => {
      if (!exerciseId) throw new ValidationError('exerciseId manquant.');
      ctx.write((db) => {
        db.coachNotesByExerciseId[exerciseId] = { notes: normalizeNotes(notes), updatedAt: ctx.now().toISOString() };
      });
    }),
  };
}
