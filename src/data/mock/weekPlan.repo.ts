import type { WeekPlanRepo } from '../ports';
import { parseWeekPlan } from '../shared/weekPlan';
import { task, type MockContext } from './db';

export function createMockWeekPlanRepo(ctx: MockContext): WeekPlanRepo {
  return {
    get: () => task(() => parseWeekPlan(ctx.read().weekPlan ?? null)),
    save: (p) => task(() => {
      ctx.write((db) => {
        db.weekPlan = { days: { A: [...p.days.A], B: [...p.days.B] }, overrides: [...p.overrides] };
      });
    }),
  };
}
