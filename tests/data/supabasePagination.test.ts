import { createSupabaseBackend } from '../../src/data/supabase';
import { BackendError, NetworkError, ValidationError } from '../../src/data/ports';
import type { PerformanceInput } from '../../src/domain/model';
import { fakeSupabase, has, ok, op, type FakeCall, type FakeResult } from './helpers';

const perfRow = (i: number) => ({
  id: `p${String(i)}`, exercise_id: 'e1', exercise_name: 'Bench', session_name: 'S', reps: 5, weight: 100, rpe: 9,
  variant_id: null, variant_name: 'Touch and Go', series_number: 1, performance_date: '2026-03-01', created_at: '2026-03-01T10:00:00Z',
});

const input = (over: Partial<PerformanceInput> = {}): PerformanceInput => ({
  exerciseId: 'e1', exerciseName: 'Bench', sessionName: 'S', reps: 5, weight: '100,5' as unknown as number, rpe: null,
  variantId: 'v1', variantName: 'Pause', serieNumber: 1, performanceDate: '2026-04-01', ...over,
});

const isOp = (c: FakeCall, m: string, table?: string) => has(c, m) && (table === undefined || c.table === table);

describe('performances.list pagination (D4)', () => {
  it('reads 2350 rows in 3 range calls ordered by date then created_at', async () => {
    const all = Array.from({ length: 2350 }, (_, i) => perfRow(i));
    const { client, calls } = fakeSupabase((c) => {
      const [from = 0, to = 0] = (op(c, 'range') ?? []) as number[];
      return ok(all.slice(from, to + 1));
    });
    const list = await createSupabaseBackend(client).performances.list();
    expect(list).toHaveLength(2350);
    expect(calls.map((c) => op(c, 'range'))).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    const orders = calls[0]?.ops.filter((o) => o.m === 'order').map((o) => o.args);
    expect(orders).toEqual([['performance_date', { ascending: false }], ['created_at', { ascending: false }], ['id', { ascending: false }]]);
    expect(calls[0]?.table).toBe('performances');
  });

  it('stops after one call when the first page is short; wraps network errors', async () => {
    const { client, calls } = fakeSupabase(() => ok([]));
    expect(await createSupabaseBackend(client).performances.list()).toEqual([]);
    expect(calls).toHaveLength(1);

    const net = fakeSupabase(() => ({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 }));
    await expect(createSupabaseBackend(net.client).performances.list()).rejects.toBeInstanceOf(NetworkError);

    const gateway = fakeSupabase(() => ({ data: null, error: { message: '<html>Service Unavailable</html>' }, status: 503 }));
    await expect(createSupabaseBackend(gateway.client).performances.list()).rejects.toBeInstanceOf(NetworkError);

    for (const status of [401, 413]) {
      const codeless = fakeSupabase(() => ({ data: null, error: { message: 'Invalid API key' }, status }));
      const e = await createSupabaseBackend(codeless.client).performances.list().catch((x: unknown) => x);
      expect(e).toBeInstanceOf(Error);
      expect(e).not.toBeInstanceOf(NetworkError);
      expect((e as Error).message).toContain('Lecture des performances');
    }

    const thrown = fakeSupabase(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(createSupabaseBackend(thrown.client).performances.list()).rejects.toBeInstanceOf(NetworkError);

    const other = fakeSupabase(() => Promise.reject(new Error('boom')));
    const otherErr = await createSupabaseBackend(other.client).performances.list().catch((e: unknown) => e);
    expect(otherErr).not.toBeInstanceOf(NetworkError);

    const pg = fakeSupabase(() => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    const err = await createSupabaseBackend(pg.client).performances.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NetworkError);
    expect((err as Error).message).toContain('permission denied');
  });
});

describe('performances.add (Supabase)', () => {
  it('writes mapped rows and returns written', async () => {
    const { client, calls } = fakeSupabase(() => ok(null));
    const res = await createSupabaseBackend(client).performances.add([input(), input({ reps: 0, weight: null, serieNumber: 2 })]);
    expect(res).toEqual({ written: 1 });
    expect(calls).toHaveLength(1);
    expect(op(calls[0] as FakeCall, 'insert')?.[0]).toEqual([{
      exercise_id: 'e1', exercise_name: 'Bench', session_name: 'S', reps: 5, weight: 100.5, rpe: 10,
      variant_id: 'v1', variant_name: 'Pause', series_number: 1, performance_date: '2026-04-01',
    }]);
  });

  it('makes no request when nothing to write; rejects invalid batch', async () => {
    const { client, calls } = fakeSupabase(() => ok(null));
    const b = createSupabaseBackend(client);
    expect(await b.performances.add([input({ reps: 0, weight: null })])).toEqual({ written: 0 });
    await expect(b.performances.add([input({ weight: null })])).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it('retries without rpe/variant_* on schema errors', async () => {
    const { client, calls } = fakeSupabase(() =>
      calls.length === 1 ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'rpe' column" } } : ok(null));
    expect(await createSupabaseBackend(client).performances.add([input()])).toEqual({ written: 1 });
    expect(calls).toHaveLength(2);
    const retried = (op(calls[1] as FakeCall, 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(retried).not.toHaveProperty('rpe');
    expect(retried).not.toHaveProperty('variant_id');
    expect(retried).not.toHaveProperty('variant_name');
    expect(retried).toMatchObject({ reps: 5, weight: 100.5, series_number: 1 });
  });

  it('does not retry on an FK error mentioning variant (23503)', async () => {
    const { client, calls } = fakeSupabase(() => ({
      data: null, error: { code: '23503', message: 'insert violates foreign key constraint "performances_variant_id_fkey"' }, status: 409,
    }));
    const err = await createSupabaseBackend(client).performances.add([input()]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NetworkError);
    expect(calls).toHaveLength(1);
  });

  it('retries on a codeless 400 mentioning rpe', async () => {
    const { client, calls } = fakeSupabase(() =>
      calls.length === 1 ? { data: null, error: { message: 'column rpe unknown' }, status: 400 } : ok(null));
    expect(await createSupabaseBackend(client).performances.add([input()])).toEqual({ written: 1 });
    expect(calls).toHaveLength(2);
  });

  it('add(): possibly-uncommitted network failure (status 0, fetch, 503) is queued (duplicate accepted); 502/504 are not', async () => {
    for (const res of [
      { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 },
      { data: null, error: { message: 'Service Unavailable' }, status: 503 },
    ]) {
      const { client } = fakeSupabase(() => res);
      await expect(createSupabaseBackend(client).performances.add([input()])).rejects.toBeInstanceOf(NetworkError);
    }
    const thrown = fakeSupabase(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(createSupabaseBackend(thrown.client).performances.add([input()])).rejects.toBeInstanceOf(NetworkError);

    // 502/504 : l'insert a pu être validé avant la perte de la réponse → pas de rejeu (doublons).
    for (const status of [502, 504]) {
      const { client, calls } = fakeSupabase(() => ({ data: null, error: { message: 'Gateway Timeout' }, status }));
      const e = await createSupabaseBackend(client).performances.add([input()]).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(Error);
      expect(e).not.toBeInstanceOf(NetworkError);
      expect((e as Error).message).toContain('a peut-être abouti');
      expect(e).toBeInstanceOf(BackendError);
      expect((e as BackendError).status).toBe(status);
      expect(calls).toHaveLength(1);
    }
  });

  it('reads still treat 502/504 as network errors', async () => {
    for (const status of [502, 504]) {
      const { client } = fakeSupabase(() => ({ data: null, error: { message: 'Bad Gateway' }, status }));
      await expect(createSupabaseBackend(client).performances.list()).rejects.toBeInstanceOf(NetworkError);
    }
  });

  it('add() rejections carry the HTTP status and Postgres code', async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: { code: '23505', message: 'duplicate' }, status: 409 }));
    const e = await createSupabaseBackend(client).performances.add([input()]).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BackendError);
    expect(e).toMatchObject({ status: 409, code: '23505' });
  });

  it('does not retry on other errors', async () => {
    const { client, calls } = fakeSupabase(() => ({ data: null, error: { code: '23505', message: 'duplicate' } }));
    await expect(createSupabaseBackend(client).performances.add([input()])).rejects.toThrow('duplicate');
    expect(calls).toHaveLength(1);
  });
});

const sessionRow = (name: string) => ({
  id: 's1', name, created_at: '2026-01-01T00:00:00Z',
  session_exercises: [{ series_count: 3, exercise_id: 'e1', exercises: { name: 'Bench' } }],
});

describe('sessions (Supabase)', () => {
  it('list() is one nested request ordered by created_at desc', async () => {
    const { client, calls } = fakeSupabase(() => ok([sessionRow('Push')]));
    const list = await createSupabaseBackend(client).sessions.list();
    expect(list).toEqual([{ id: 's1', name: 'Push', createdAt: '2026-01-01T00:00:00Z', cycle: null, exercises: [{ exerciseId: 'e1', name: 'Bench', series: 3 }] }]);
    expect(calls).toHaveLength(1);
    expect(op(calls[0] as FakeCall, 'select')?.[0]).toContain('session_exercises(series_count, exercise_id, exercises(name))');
    expect(op(calls[0] as FakeCall, 'order')).toEqual(['created_at', { ascending: false }]);
  });

  it('update() renames performances before the session, so a retry after a failed rename still renames (D5)', async () => {
    let failRename = true;
    let sessionName = 'Push';
    const { client, calls } = fakeSupabase((c) => {
      if (c.table === 'performances') {
        if (failRename) { failRename = false; return { data: null, error: { code: '57014', message: 'timeout' }, status: 500 }; }
        return ok(null);
      }
      if (isOp(c, 'update', 'sessions')) { sessionName = 'Push A'; return ok(null); }
      if (c.table === 'sessions' && has(c, 'single')) return ok(sessionRow(sessionName));
      return ok(null);
    });
    const b = createSupabaseBackend(client);
    const draft = { cycle: null, name: 'Push A', exercises: [{ exerciseId: 'e1', series: 3 }] };
    await expect(b.sessions.update('s1', draft)).rejects.toThrow('timeout');
    expect(calls.some((c) => isOp(c, 'update', 'sessions'))).toBe(false);
    expect((await b.sessions.update('s1', draft)).name).toBe('Push A');
    const renames = calls.filter((c) => c.table === 'performances');
    expect(renames).toHaveLength(2);
    expect(op(renames[1] as FakeCall, 'eq')).toEqual(['session_name', 'Push']);
  });

  it('update() renames performances when the name changes (D5)', async () => {
    let renamed = false;
    const { client, calls } = fakeSupabase((c) => {
      if (c.table === 'performances') { renamed = true; return ok(null); }
      if (c.table === 'sessions' && has(c, 'single')) return ok(sessionRow(renamed ? 'Push A' : 'Push'));
      return ok(null);
    });
    const s = await createSupabaseBackend(client).sessions.update('s1', { cycle: null, name: ' Push A ', exercises: [{ exerciseId: 'e1', series: 3 }] });
    expect(s.name).toBe('Push A');
    const rename = calls.find((c) => c.table === 'performances');
    expect(op(rename as FakeCall, 'update')).toEqual([{ session_name: 'Push A' }]);
    expect(op(rename as FakeCall, 'eq')).toEqual(['session_name', 'Push']);
    const del = calls.find((c) => isOp(c, 'delete', 'session_exercises'));
    expect(op(del as FakeCall, 'eq')).toEqual(['session_id', 's1']);
    const ins = calls.find((c) => isOp(c, 'insert', 'session_exercises'));
    expect(op(ins as FakeCall, 'insert')?.[0]).toEqual([{ session_id: 's1', exercise_id: 'e1', series_count: 3 }]);
  });

  it('update() with the same name does not touch performances; create() re-reads', async () => {
    const { client, calls } = fakeSupabase((c) => {
      if (isOp(c, 'insert', 'sessions')) return ok({ id: 's1' });
      if (c.table === 'sessions' && has(c, 'single')) return ok(sessionRow('Push'));
      return ok(null);
    });
    const b = createSupabaseBackend(client);
    await b.sessions.update('s1', { cycle: null, name: 'Push', exercises: [{ exerciseId: 'e1', series: 3 }] });
    expect(calls.some((c) => c.table === 'performances')).toBe(false);
    const created = await b.sessions.create({ cycle: null, name: 'Push', exercises: [{ exerciseId: 'e1', series: 3 }] });
    expect(created.id).toBe('s1');
    await b.sessions.remove('s1');
    expect(calls.some((c) => isOp(c, 'delete', 'sessions'))).toBe(true);
  });
});

describe('exercises (Supabase)', () => {
  const view = { id: 'e1', name: 'Bench', description: 'd', muscle_groups: ['Pecs'], is_custom: true, created_at: '2026-01-01T00:00:00Z' };
  const variants = [{ id: 'v1', exercise_id: 'e1', name: 'Touch and Go', is_default: true }];

  function backend(extra?: (c: FakeCall) => FakeResult | undefined) {
    return fakeSupabase((c) => {
      const r = extra?.(c);
      if (r) return r;
      if (c.table === 'exercises_with_muscles') return ok(has(c, 'single') ? view : [view, { bad: true }]);
      if (c.table === 'exercise_variants' && has(c, 'select')) return ok(variants);
      if (c.table === 'coach_notes' && has(c, 'select')) return ok([{ exercise_id: 'e1', notes: 'hello' }]);
      if (isOp(c, 'insert', 'exercises')) return ok({ id: 'e1' });
      return ok(null);
    });
  }

  it('list() = view + one variants query + one notes query', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, calls } = backend();
    const list = await createSupabaseBackend(client).exercises.list();
    expect(list).toEqual([{ ...{ id: 'e1', name: 'Bench', description: 'd', muscleGroups: ['Pecs'], isCustom: true, createdAt: '2026-01-01T00:00:00Z' }, coachNotes: 'hello', variants: [{ id: 'v1', exerciseId: 'e1', name: 'Touch and Go', isDefault: true }] }]);
    expect(calls).toHaveLength(3);
    expect(op(calls.find((c) => c.table === 'exercise_variants') as FakeCall, 'in')).toEqual(['exercise_id', ['e1']]);
  });

  it('list() tolerates a missing variants table', async () => {
    const { client } = backend((c) => (c.table === 'exercise_variants' ? { data: null, error: { code: '42P01', message: 'relation does not exist' } } : undefined));
    const [e] = await createSupabaseBackend(client).exercises.list();
    expect(e?.variants).toEqual([{ id: null, exerciseId: 'e1', name: 'Touch and Go', isDefault: true }]);
  });

  it('create() inserts exercise, muscles, variants then re-reads', async () => {
    const { client, calls } = backend();
    const e = await createSupabaseBackend(client).exercises.create({ name: ' Bench ', description: 'd', muscleGroups: ['Pecs', 'pecs'], variants: [] });
    expect(e.variants[0]?.id).toBe('v1');
    expect(op(calls.find((c) => isOp(c, 'insert', 'exercises')) as FakeCall, 'insert')?.[0]).toEqual([{ name: 'Bench', description: 'd', is_custom: true }]);
    expect(op(calls.find((c) => isOp(c, 'insert', 'muscle_groups')) as FakeCall, 'insert')?.[0]).toEqual([{ exercise_id: 'e1', muscle_group: 'Pecs' }]);
    expect(op(calls.find((c) => isOp(c, 'insert', 'exercise_variants')) as FakeCall, 'insert')?.[0]).toEqual([{ exercise_id: 'e1', name: 'Touch and Go', is_default: true }]);
  });

  it('update() retries without updated_at and syncs variants', async () => {
    let first = true;
    const { client, calls } = backend((c) => {
      if (isOp(c, 'update', 'exercises') && first) { first = false; return { data: null, error: { code: '42703', message: 'column updated_at does not exist' } }; }
      return undefined;
    });
    await createSupabaseBackend(client).exercises.update('e1', {
      name: 'Bench', description: 'd', muscleGroups: [],
      variants: [{ id: null, exerciseId: 'e1', name: 'Pause', isDefault: true }],
    });
    const updates = calls.filter((c) => isOp(c, 'update', 'exercises'));
    expect(updates).toHaveLength(2);
    expect(op(updates[1] as FakeCall, 'update')?.[0]).toEqual({ name: 'Bench', description: 'd' });
    expect(op(calls.find((c) => isOp(c, 'delete', 'exercise_variants')) as FakeCall, 'in')).toEqual(['id', ['v1']]);
    expect(calls.some((c) => isOp(c, 'insert', 'exercise_variants'))).toBe(true);
    expect(calls.some((c) => isOp(c, 'insert', 'muscle_groups'))).toBe(false);
  });

  it('remove() deletes the exercise row', async () => {
    const { client, calls } = backend();
    await createSupabaseBackend(client).exercises.remove('e1');
    expect(op(calls[0] as FakeCall, 'eq')).toEqual(['id', 'e1']);
  });
});

describe('coach notes, advice (Supabase)', () => {
  it('coachNotes.save updates when a row exists, inserts otherwise', async () => {
    let exists = true;
    const { client, calls } = fakeSupabase((c) => (has(c, 'select') ? ok(exists ? [{ id: 1 }] : []) : ok(null)));
    const b = createSupabaseBackend(client);
    await b.coachNotes.save('e1', 'a\r\nb');
    expect(op(calls[1] as FakeCall, 'update')?.[0]).toMatchObject({ notes: 'a\nb' });
    exists = false;
    await b.coachNotes.save('e1', 'c');
    expect(op(calls[3] as FakeCall, 'insert')?.[0]).toEqual([{ exercise_id: 'e1', notes: 'c' }]);
  });

  it('advice get/save singleton', async () => {
    const { client, calls } = fakeSupabase((c) => (has(c, 'single') ? ok({ training_notes: 't', nutrition_notes: 'n', sleep_notes: 's' }) : ok(null)));
    const b = createSupabaseBackend(client);
    expect(await b.advice.get()).toEqual({ training: 't', nutrition: 'n', sleep: 's' });
    expect(op(calls[0] as FakeCall, 'eq')).toEqual(['id', 1]);
    await b.advice.save({ training: 'a', nutrition: 'b', sleep: 'c' });
    const [rows, opts] = op(calls[1] as FakeCall, 'upsert') ?? [];
    expect((rows as Record<string, unknown>[])[0]).toMatchObject({ id: 1, training_notes: 'a', nutrition_notes: 'b', sleep_notes: 'c' });
    expect(opts).toEqual({ onConflict: 'id' });
    const none = fakeSupabase(() => ({ data: null, error: { code: 'PGRST116', message: '0 rows' } }));
    expect(await createSupabaseBackend(none.client).advice.get()).toBeNull();
  });
});
