import type { JournalRepo } from '../ports';
import { parseJournal } from '../shared/journal';
import { task, type MockContext } from './db';

export function createMockJournalRepo(ctx: MockContext): JournalRepo {
  return {
    get: () => task(() => parseJournal(ctx.read().journal ?? null)),
    save: (j) => task(() => {
      ctx.write((db) => {
        db.journal = structuredClone(j);
      });
    }),
  };
}
