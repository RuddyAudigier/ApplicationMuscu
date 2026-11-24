import type { Id } from '../../domain/model';
import type { CoachNotesRepo } from '../ports';
import { type Db, fail, isSchemaGap, must, run } from './client';
import { normalizeNotes } from '../shared/rules';

export function createCoachNotesRepo(db: Db): CoachNotesRepo {
  return {
    /** Une seule requête pour toutes les notes (pas de N+1). */
    async listAll() {
      const ctx = 'Lecture des remarques';
      const { data, error, status } = await run(db.from('coach_notes').select('exercise_id, notes'), ctx);
      if (error) {
        if (isSchemaGap(error)) return {};
        fail(error, ctx, status);
      }
      const out: Record<Id, string> = {};
      if (Array.isArray(data)) {
        for (const row of data as unknown[]) {
          if (typeof row !== 'object' || row === null) continue;
          const { exercise_id: id, notes } = row as { exercise_id?: unknown; notes?: unknown };
          if (typeof id === 'string' && typeof notes === 'string') out[id] = notes;
        }
      }
      return out;
    },

    /** Select puis update ou insert, comme l'existant (pas d'upsert : pas de contrainte unique connue). */
    async save(exerciseId, notes) {
      const ctx = 'Sauvegarde des remarques';
      const text = normalizeNotes(notes);
      const existing = await must(db.from('coach_notes').select('id').eq('exercise_id', exerciseId), ctx);
      if (Array.isArray(existing) && existing.length > 0) {
        await must(db.from('coach_notes').update({ notes: text, updated_at: new Date().toISOString() }).eq('exercise_id', exerciseId), ctx);
      } else {
        await must(db.from('coach_notes').insert([{ exercise_id: exerciseId, notes: text }]), ctx);
      }
    },
  };
}
