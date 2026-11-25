import type { WeekPlan } from '../../domain/model';
import type { WeekPlanRepo } from '../ports';
import { parseWeekPlan } from '../shared/weekPlan';
import { type Db, fail, isSchemaGap, NO_ROWS, run } from './client';

const SINGLETON_ID = 1;
/** Repli local tant que `scripts/sql/2026-11-24_week_plan.sql` n'est pas joué. */
const STORAGE_KEY = 'mymuscle_week_plan_v1';

function readLocal(storage: Storage): WeekPlan | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? parseWeekPlan(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Table `week_plan` ; absente → repli `localStorage` (un seul avertissement). */
export function createWeekPlanRepo(db: Db, storage: Storage): WeekPlanRepo {
  let warned = false;
  const warn = (): void => {
    if (warned) return;
    warned = true;
    console.warn('[data] Table week_plan absente (scripts/sql/2026-11-24_week_plan.sql non joué) : '
      + 'le planning est enregistré sur cet appareil uniquement.');
  };
  return {
    async get() {
      const ctx = 'Lecture du planning';
      const { data, error, status } = await run(
        db.from('week_plan').select('days, overrides').eq('id', SINGLETON_ID).single(), ctx);
      if (error) {
        if (isSchemaGap(error)) warn();
        else if (error.code !== NO_ROWS) fail(error, ctx, status);
        return readLocal(storage);
      }
      return parseWeekPlan(data);
    },

    async save(p) {
      const ctx = 'Sauvegarde du planning';
      const { error, status } = await run(db.from('week_plan').upsert([{
        id: SINGLETON_ID,
        days: p.days,
        overrides: p.overrides,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'id' }), ctx);
      if (!error) return;
      if (!isSchemaGap(error)) fail(error, ctx, status);
      warn();
      storage.setItem(STORAGE_KEY, JSON.stringify(p));
    },
  };
}
