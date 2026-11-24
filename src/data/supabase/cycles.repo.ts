import type { CyclesRepo } from '../ports';
import { type Db, fail, isSchemaGap, NO_ROWS, run } from './client';
import type { CycleFallback } from './cycleFallback';
import { weeksForDays } from '../../domain/cycles';
import { mapCycleStateRow } from './mappers';

const SINGLETON_ID = 1;

/** Table `cycle_state` (migration 2026-11-23) ; absente → repli `localStorage` (un seul avertissement). */
export function createCyclesRepo(db: Db, fallback: CycleFallback): CyclesRepo {
  return {
    async get() {
      const ctx = 'Lecture du cycle en cours';
      const { data, error, status } = await run(
        db.from('cycle_state').select('current, started_on, weeks, length_days, extra_days').eq('id', SINGLETON_ID).single(), ctx);
      if (error) {
        if (isSchemaGap(error)) {
          fallback.warn();
          // Colonnes de durée absentes (migration 2026-11-25 non jouée) : l'ancienne ligne reste lisible,
          // mais un état enregistré sur l'appareil depuis est plus récent.
          const local = fallback.state();
          if (local) return local;
          const legacy = await run(
            db.from('cycle_state').select('current, started_on, weeks').eq('id', SINGLETON_ID).single(), ctx);
          return legacy.error ? null : mapCycleStateRow(legacy.data);
        }
        if (error.code !== NO_ROWS) fail(error, ctx, status);
        // Pas de ligne : état éventuellement réglé avant la migration.
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
        weeks: weeksForDays(s.lengthDays + s.extraDays),
        length_days: s.lengthDays,
        extra_days: s.extraDays,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'id' }), ctx);
      if (!error) return;
      if (!isSchemaGap(error)) fail(error, ctx, status);
      fallback.warn();
      fallback.setState(s);
    },
  };
}
