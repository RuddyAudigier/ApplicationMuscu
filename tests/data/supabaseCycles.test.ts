import { createSupabaseBackend } from '../../src/data/supabase';
import { NetworkError } from '../../src/data/ports';
import { fakeSupabase, has, MemoryStorage, ok, op, type FakeCall, type FakeResult } from './helpers';

const FALLBACK_KEY = 'mymuscle_cycles_v1';

const sessionRow = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Push', created_at: '2026-01-01T00:00:00Z',
  session_exercises: [{ series_count: 3, exercise_id: 'e1', exercises: { name: 'Bench' } }], ...over,
});

const isOp = (c: FakeCall, m: string, table: string) => c.table === table && has(c, m);
const selectOf = (c: FakeCall): string => {
  const cols = op(c, 'select')?.[0];
  return typeof cols === 'string' ? cols : '';
};
const missingColumn: FakeResult = { data: null, error: { code: '42703', message: 'column sessions.cycle does not exist' }, status: 400 };
const missingCache: FakeResult = { data: null, error: { code: 'PGRST204', message: "Could not find the 'cycle' column of 'sessions' in the schema cache" }, status: 400 };
const missingTable: FakeResult = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.cycle_state' in the schema cache" }, status: 404 };
const draft = (cycle: 'A' | 'B' | null) => ({ cycle, name: 'Push', exercises: [{ exerciseId: 'e1', series: 3 }] });

function stored(storage: Storage): unknown {
  return JSON.parse(storage.getItem(FALLBACK_KEY) ?? 'null');
}

describe('sessions cycle column (Supabase)', () => {
  it('reads cycle in list() and readOne, writes it on create and update', async () => {
    const { client, calls } = fakeSupabase((c) => {
      if (isOp(c, 'insert', 'sessions')) return ok({ id: 's1' });
      if (c.table === 'sessions' && has(c, 'select')) return ok(has(c, 'single') ? sessionRow({ cycle: 'B' }) : [sessionRow({ cycle: 'A' })]);
      return ok(null);
    });
    const storage = new MemoryStorage();
    const b = createSupabaseBackend(client, storage);
    expect((await b.sessions.list())[0]?.cycle).toBe('A');
    expect(selectOf(calls[0] as FakeCall)).toMatch(/\bcycle\b/);

    const created = await b.sessions.create(draft('B'));
    expect(created.cycle).toBe('B');
    expect(op(calls.find((c) => isOp(c, 'insert', 'sessions')) as FakeCall, 'insert')?.[0]).toEqual([{ name: 'Push', cycle: 'B' }]);

    await b.sessions.update('s1', draft('A'));
    expect(op(calls.find((c) => isOp(c, 'update', 'sessions')) as FakeCall, 'update')?.[0]).toEqual({ name: 'Push', cycle: 'A' });
    expect(calls.filter((c) => c.table === 'sessions' && has(c, 'select') && !has(c, 'insert')).every((c) => /\bcycle\b/.test(selectOf(c)))).toBe(true);
    expect(storage.getItem(FALLBACK_KEY)).toBeNull();
  });

  it('falls back to localStorage when the column is missing, with a single warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, calls } = fakeSupabase((c) => {
      if (isOp(c, 'insert', 'sessions')) return 'cycle' in ((op(c, 'insert')?.[0] as object[])[0] ?? {}) ? missingCache : ok({ id: 's1' });
      if (isOp(c, 'update', 'sessions')) return 'cycle' in (op(c, 'update')?.[0] as object) ? missingCache : ok(null);
      if (c.table === 'sessions' && has(c, 'select')) {
        if (/\bcycle\b/.test(selectOf(c))) return missingColumn;
        return ok(has(c, 'single') ? sessionRow() : [sessionRow()]);
      }
      return ok(null);
    });
    const storage = new MemoryStorage();
    const b = createSupabaseBackend(client, storage);

    const created = await b.sessions.create(draft('B'));
    expect(created.cycle).toBe('B');
    expect(stored(storage)).toMatchObject({ sessions: { s1: 'B' } });
    expect((await b.sessions.list())[0]?.cycle).toBe('B');

    const updated = await b.sessions.update('s1', draft('A'));
    expect(updated.cycle).toBe('A');
    expect((await b.sessions.list())[0]?.cycle).toBe('A');

    await b.sessions.update('s1', draft(null));
    expect((await b.sessions.list())[0]?.cycle).toBeNull();

    // Une fois l'absence détectée, la colonne n'est plus demandée.
    const selects = calls.filter((c) => c.table === 'sessions' && has(c, 'select') && !has(c, 'insert'));
    expect(selects.filter((c) => /\bcycle\b/.test(selectOf(c)))).toHaveLength(0);
    await b.cycles.save({ current: 'A', startedOn: '2026-11-23', weeks: 2 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('2026-11-23_cycles.sql');

    await b.sessions.remove('s1');
    expect(stored(storage)).toMatchObject({ sessions: {} });
  });

  it('detects the missing column on the first read too', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem(FALLBACK_KEY, JSON.stringify({ sessions: { s1: 'B' }, state: null }));
    const { client } = fakeSupabase((c) => (/\bcycle\b/.test(selectOf(c)) ? missingColumn : ok([sessionRow()])));
    expect((await createSupabaseBackend(client, storage).sessions.list())[0]?.cycle).toBe('B');
  });

  it('does not fall back on other errors', async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    const b = createSupabaseBackend(client, new MemoryStorage());
    await expect(b.sessions.list()).rejects.toThrow('permission denied');
    await expect(b.sessions.create(draft('A'))).rejects.toThrow('permission denied');
  });

  it('a db value wins over a stale local one; a column write clears the local entry', async () => {
    const storage = new MemoryStorage();
    storage.setItem(FALLBACK_KEY, JSON.stringify({ sessions: { s1: 'B', s2: 'A' }, state: null }));
    const { client } = fakeSupabase((c) => {
      if (c.table === 'sessions' && has(c, 'single')) return ok(sessionRow({ cycle: 'A' }));
      if (c.table === 'sessions' && has(c, 'select')) return ok([sessionRow({ cycle: 'A' }), sessionRow({ id: 's2', cycle: null })]);
      return ok(null);
    });
    const b = createSupabaseBackend(client, storage);
    expect((await b.sessions.list()).map((s) => s.cycle)).toEqual(['A', 'A']);
    await b.sessions.update('s1', draft('A'));
    expect(stored(storage)).toEqual({ sessions: { s2: 'A' }, state: null });
  });

  it('ignores a corrupt fallback entry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem(FALLBACK_KEY, '{oops');
    const { client } = fakeSupabase((c) => (/\bcycle\b/.test(selectOf(c)) ? missingColumn : ok([sessionRow()])));
    expect((await createSupabaseBackend(client, storage).sessions.list())[0]?.cycle).toBeNull();
  });
});

describe('cycles repo (Supabase)', () => {
  it('get() maps the singleton row; save() upserts id 1', async () => {
    const { client, calls } = fakeSupabase((c) => (has(c, 'single') ? ok({ current: 'B', started_on: '2026-11-09', weeks: 3 }) : ok(null)));
    const b = createSupabaseBackend(client, new MemoryStorage());
    expect(await b.cycles.get()).toEqual({ current: 'B', startedOn: '2026-11-09', weeks: 3 });
    expect(calls[0]?.table).toBe('cycle_state');
    expect(op(calls[0] as FakeCall, 'eq')).toEqual(['id', 1]);
    await b.cycles.save({ current: 'A', startedOn: '2026-11-23', weeks: 2 });
    const [rows, opts] = op(calls[1] as FakeCall, 'upsert') ?? [];
    expect((rows as Record<string, unknown>[])[0]).toMatchObject({ id: 1, current: 'A', started_on: '2026-11-23', weeks: 2 });
    expect(opts).toEqual({ onConflict: 'id' });
  });

  it('get() returns null when there is no row and nothing local; invalid row → null', async () => {
    const none = fakeSupabase(() => ({ data: null, error: { code: 'PGRST116', message: '0 rows' } }));
    expect(await createSupabaseBackend(none.client, new MemoryStorage()).cycles.get()).toBeNull();
    const bad = fakeSupabase(() => ok({ current: 'C', started_on: 'x', weeks: 5 }));
    expect(await createSupabaseBackend(bad.client, new MemoryStorage()).cycles.get()).toBeNull();
  });

  it('get() without a row returns a state saved locally before the migration', async () => {
    const storage = new MemoryStorage();
    storage.setItem(FALLBACK_KEY, JSON.stringify({ sessions: {}, state: { current: 'B', startedOn: '2026-11-02', weeks: 2 } }));
    const none = fakeSupabase(() => ({ data: null, error: { code: 'PGRST116', message: '0 rows' } }));
    expect(await createSupabaseBackend(none.client, storage).cycles.get()).toEqual({ current: 'B', startedOn: '2026-11-02', weeks: 2 });
  });

  it.each([['PGRST205', missingTable], ['42P01', { data: null, error: { code: '42P01', message: 'relation "cycle_state" does not exist' } }]])(
    'falls back to localStorage when the table is missing (%s)',
    async (_code, missing) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const storage = new MemoryStorage();
      const { client } = fakeSupabase(() => missing);
      const b = createSupabaseBackend(client, storage);
      expect(await b.cycles.get()).toBeNull();
      await b.cycles.save({ current: 'B', startedOn: '2026-11-16', weeks: 3 });
      expect(await b.cycles.get()).toEqual({ current: 'B', startedOn: '2026-11-16', weeks: 3 });
      expect(stored(storage)).toMatchObject({ state: { current: 'B', startedOn: '2026-11-16', weeks: 3 } });
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates other errors and network failures', async () => {
    const pg = fakeSupabase(() => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    const b = createSupabaseBackend(pg.client, new MemoryStorage());
    await expect(b.cycles.get()).rejects.toThrow('permission denied');
    await expect(b.cycles.save({ current: 'A', startedOn: '2026-11-23', weeks: 2 })).rejects.toThrow('permission denied');
    const net = fakeSupabase(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(createSupabaseBackend(net.client, new MemoryStorage()).cycles.get()).rejects.toBeInstanceOf(NetworkError);
  });

  it('survives a storage that throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const { client } = fakeSupabase(() => missingTable);
    const b = createSupabaseBackend(client, storage);
    await b.cycles.save({ current: 'A', startedOn: '2026-11-23', weeks: 2 });
    expect(await b.cycles.get()).toBeNull();
  });
});
