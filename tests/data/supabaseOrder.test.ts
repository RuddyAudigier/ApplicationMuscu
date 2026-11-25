import { createSupabaseBackend } from '../../src/data/supabase';
import { fakeSupabase, has, MemoryStorage, ok, op, type FakeCall, type FakeResult } from './helpers';

const selectOf = (c: FakeCall): string => {
  const cols = op(c, 'select')?.[0];
  return typeof cols === 'string' ? cols : '';
};
const isOp = (c: FakeCall, m: string, table: string) => c.table === table && has(c, m);
const link = (id: string, name: string, position: number | null | undefined) => ({
  series_count: 3, exercise_id: id, exercises: { name }, ...(position === undefined ? {} : { position }),
});
const row = (links: unknown[]) => ({ id: 's1', name: 'Push', created_at: '2026-01-01T00:00:00Z', cycle: 'A', session_exercises: links });
const draft = { cycle: 'A' as const, name: 'Push', exercises: [{ exerciseId: 'e2', series: 3 }, { exerciseId: 'e1', series: 4 }] };

const missingPositionRead: FakeResult = { data: null, error: { code: '42703', message: 'column session_exercises_1.position does not exist' }, status: 400 };
const missingPositionWrite: FakeResult = { data: null, error: { code: 'PGRST204', message: "Could not find the 'position' column of 'session_exercises' in the schema cache" }, status: 400 };

describe('session exercise order (Supabase)', () => {
  it('writes position = index and reads ordered by position, nulls last, stable otherwise', async () => {
    const { client, calls } = fakeSupabase((c) => {
      if (isOp(c, 'insert', 'sessions')) return ok({ id: 's1' });
      if (c.table === 'sessions' && has(c, 'select')) {
        const r = row([link('e3', 'C', null), link('e1', 'A', 1), link('e4', 'D', null), link('e2', 'B', 0)]);
        return ok(has(c, 'single') ? r : [r]);
      }
      return ok(null);
    });
    const b = createSupabaseBackend(client, new MemoryStorage());
    expect((await b.sessions.list())[0]?.exercises.map((e) => e.exerciseId)).toEqual(['e2', 'e1', 'e3', 'e4']);
    expect(selectOf(calls[0] as FakeCall)).toMatch(/session_exercises\([^)]*\bposition\b/);

    await b.sessions.create(draft);
    expect(op(calls.find((c) => isOp(c, 'insert', 'session_exercises')) as FakeCall, 'insert')?.[0]).toEqual([
      { session_id: 's1', exercise_id: 'e2', series_count: 3, position: 0 },
      { session_id: 's1', exercise_id: 'e1', series_count: 4, position: 1 },
    ]);
  });

  it('missing position column: reads and writes retry without it, keeping cycle, and remember it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, calls } = fakeSupabase((c) => {
      if (isOp(c, 'insert', 'sessions')) return ok({ id: 's1' });
      if (isOp(c, 'insert', 'session_exercises')) {
        const rows = op(c, 'insert')?.[0] as Record<string, unknown>[];
        return rows.some((r) => 'position' in r) ? missingPositionWrite : ok(null);
      }
      if (c.table === 'sessions' && has(c, 'select')) {
        if (/\bposition\b/.test(selectOf(c))) return missingPositionRead;
        return ok(has(c, 'single') ? row([link('e2', 'B', undefined), link('e1', 'A', undefined)]) : [row([link('e2', 'B', undefined)])]);
      }
      return ok(null);
    });
    const b = createSupabaseBackend(client, new MemoryStorage());
    const [s] = await b.sessions.list();
    expect(s?.cycle).toBe('A');
    const created = await b.sessions.create(draft);
    expect(created.exercises.map((e) => e.exerciseId)).toEqual(['e2', 'e1']);
    await b.sessions.update('s1', draft);

    const linkInserts = calls.filter((c) => isOp(c, 'insert', 'session_exercises'));
    // Absence détectée à la lecture : les écritures ne l'envoient plus.
    expect(linkInserts.map((c) => (op(c, 'insert')?.[0] as Record<string, unknown>[]).some((r) => 'position' in r))).toEqual([false, false]);
    const reads = calls.filter((c) => c.table === 'sessions' && has(c, 'select') && !has(c, 'insert'));
    expect(reads.filter((c) => /\bposition\b/.test(selectOf(c)))).toHaveLength(1);
    expect(reads.every((c) => /\bcycle\b/.test(selectOf(c)))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('missing position column detected on the first write: retried without it, then remembered', async () => {
    const { client, calls } = fakeSupabase((c) => {
      if (isOp(c, 'insert', 'sessions')) return ok({ id: 's1' });
      if (isOp(c, 'insert', 'session_exercises')) {
        const rows = op(c, 'insert')?.[0] as Record<string, unknown>[];
        return rows.some((r) => 'position' in r) ? missingPositionWrite : ok(null);
      }
      if (c.table === 'sessions' && has(c, 'select')) return ok(row([link('e2', 'B', undefined), link('e1', 'A', undefined)]));
      return ok(null);
    });
    const b = createSupabaseBackend(client, new MemoryStorage());
    await b.sessions.create(draft);
    await b.sessions.update('s1', draft);
    const linkInserts = calls.filter((c) => isOp(c, 'insert', 'session_exercises'));
    expect(linkInserts.map((c) => (op(c, 'insert')?.[0] as Record<string, unknown>[]).some((r) => 'position' in r))).toEqual([true, false, false]);
  });

  it('a non-schema error on the links insert is not retried', async () => {
    const { client } = fakeSupabase((c) => {
      if (isOp(c, 'insert', 'sessions')) return ok({ id: 's1' });
      if (isOp(c, 'insert', 'session_exercises')) return { data: null, error: { code: '23503', message: 'fk' }, status: 409 };
      return ok(null);
    });
    await expect(createSupabaseBackend(client, new MemoryStorage()).sessions.create(draft)).rejects.toThrow('fk');
  });

  it('both columns missing: falls back for each', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const missingCycle: FakeResult = { data: null, error: { code: '42703', message: 'column sessions.cycle does not exist' }, status: 400 };
    const { client } = fakeSupabase((c) => {
      const cols = selectOf(c);
      if (/\bposition\b/.test(cols)) return missingPositionRead;
      if (/\bcycle\b/.test(cols)) return missingCycle;
      return ok([{ ...row([link('e2', 'B', undefined)]), cycle: undefined }]);
    });
    const [s] = await createSupabaseBackend(client, new MemoryStorage()).sessions.list();
    expect(s?.exercises.map((e) => e.exerciseId)).toEqual(['e2']);
    expect(s?.cycle).toBeNull();
  });
});
