import type { SharePayload } from '../../domain/model';
import type { SharedSessionsRepo } from '../ports';
import { task, type MockContext } from './db';

export function createMockSharedRepo(ctx: MockContext): SharedSessionsRepo {
  return {
    get: (id) => task(() => {
      const payload = ctx.read().sharedSessions.find((s) => s.id === id)?.payload;
      return typeof payload === 'object' && payload !== null ? (payload as SharePayload) : null;
    }),
  };
}
