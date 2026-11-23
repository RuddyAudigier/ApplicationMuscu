import type { SharePayload } from '../../domain/model';
import type { SharedSessionsRepo } from '../ports';
import { type Db, fail, NO_ROWS, run } from './client';

/** `22P02` : id non-uuid (lien de partage altéré) → introuvable. */
const NOT_FOUND = [NO_ROWS, '22P02'];

export function createSharedRepo(db: Db): SharedSessionsRepo {
  return {
    async get(id) {
      const ctx = 'Lecture du partage';
      const { data, error } = await run(db.from('shared_sessions').select('payload').eq('id', id).single(), ctx);
      if (error) {
        if (error.code !== undefined && NOT_FOUND.includes(error.code)) return null;
        fail(error, ctx);
      }
      const payload = (data as { payload?: unknown } | null)?.payload;
      if (typeof payload !== 'object' || payload === null) return null;
      return payload as SharePayload;
    },
  };
}
