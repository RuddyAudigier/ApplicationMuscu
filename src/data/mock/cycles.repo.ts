import type { CyclesRepo } from '../ports';
import { task, type MockContext } from './db';

export function createMockCyclesRepo(ctx: MockContext): CyclesRepo {
  return {
    get: () => task(() => {
      const s = ctx.read().cycleState;
      return s ? { current: s.current, startedOn: s.startedOn, weeks: s.weeks } : null;
    }),
    save: (s) => task(() => {
      ctx.write((db) => {
        db.cycleState = { current: s.current, startedOn: s.startedOn, weeks: s.weeks };
      });
    }),
  };
}
