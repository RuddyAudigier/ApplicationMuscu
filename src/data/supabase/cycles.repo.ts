import type { CyclesRepo } from '../ports';
import { type Db, fail, isSchemaGap, NO_ROWS, run } from './client';
import type { CycleFallback } from './cycleFallback';
import { mapCycleStateRow } from './mappers';

const SINGLETON_ID = 1;

/** Table `cycle_state` (migration 2026-11-23) ; absente → repli `localStorage` (un seul avertissement). */
export function createCyclesRepo(db: Db, fallback: CycleFallback): CyclesRepo {
  return {
    async get() {
      const ctx = 'Lecture du cycle en cours';
      const { data, error, status } = await run(
        db.from('cycle_state').select('current, started_on, weeks').eq('id', SINGLETON_ID).single(), ctx);
      if (error) {
        if (isSchemaGap(error)) fallback.warn();
        else if (error.code !== NO_ROWS) fail(error, ctx, status);
        // Pas de ligne (ou pas de table) : état éventuellement réglé avant la migration.
        return fallback.state();
      }
      return mapCycleStateRow(data);
    },

    async save(s) {
      const ctx = 'Sauvegarde du cycle en cours';
      const { error, status } = await run(db.from('cycle_state').upsert([{
        id: SINGLETON_ID,
        current: s.current,
        started_on: s.startedOn,
        weeks: s.weeks,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'id' }), ctx);
      if (!error) return;
      if (!isSchemaGap(error)) fail(error, ctx, status);
      fallback.warn();
      fallback.setState(s);
    },
  };
}
