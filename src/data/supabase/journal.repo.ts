import type { Journal } from '../../domain/journal';
import type { JournalRepo } from '../ports';
import { parseJournal } from '../shared/journal';
import { type Db, fail, isSchemaGap, NO_ROWS, run } from './client';

const SINGLETON_ID = 1;
/** Repli local tant que `scripts/sql/2026-11-25_journal.sql` n'est pas joué. */
const STORAGE_KEY = 'mymuscle_journal_v1';

function readLocal(storage: Storage): Journal | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? parseJournal(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Table `journal` ; absente → repli `localStorage` (un seul avertissement). */
export function createJournalRepo(db: Db, storage: Storage): JournalRepo {
  let warned = false;
  const warn = (): void => {
    if (warned) return;
    warned = true;
    console.warn('[data] Table journal absente (scripts/sql/2026-11-25_journal.sql non joué) : '
      + 'le journal est enregistré sur cet appareil uniquement.');
  };
  return {
    async get() {
      const ctx = 'Lecture du journal';
      const { data, error, status } = await run(
        db.from('journal').select('logs, block_notes, warmups').eq('id', SINGLETON_ID).single(), ctx);
      if (error) {
        if (isSchemaGap(error)) warn();
        else if (error.code !== NO_ROWS) fail(error, ctx, status);
        return readLocal(storage);
      }
      const row = data as { logs: unknown; block_notes: unknown; warmups: unknown };
      return parseJournal({ logs: row.logs, blockNotes: row.block_notes, warmups: row.warmups });
    },

    async save(j) {
      const ctx = 'Sauvegarde du journal';
      const { error, status } = await run(db.from('journal').upsert([{
        id: SINGLETON_ID,
        logs: j.logs,
        block_notes: j.blockNotes,
        warmups: j.warmups,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'id' }), ctx);
      if (!error) return;
      if (!isSchemaGap(error)) fail(error, ctx, status);
      warn();
      storage.setItem(STORAGE_KEY, JSON.stringify(j));
    },
  };
}
