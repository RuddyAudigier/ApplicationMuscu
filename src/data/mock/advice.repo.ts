import type { AdviceRepo } from '../ports';
import { task, type MockContext } from './db';

export function createMockAdviceRepo(ctx: MockContext): AdviceRepo {
  return {
    get: () => task(() => {
      const a = ctx.read().generalAdvice;
      return a ? { training: a.training, nutrition: a.nutrition, sleep: a.sleep } : null;
    }),
    save: (a) => task(() => {
      ctx.write((db) => {
        db.generalAdvice = { training: a.training, nutrition: a.nutrition, sleep: a.sleep, updatedAt: ctx.now().toISOString() };
      });
    }),
  };
}
