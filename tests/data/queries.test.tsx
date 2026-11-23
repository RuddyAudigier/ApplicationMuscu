import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMockBackend } from '../../src/data/mock';
import { enqueue, flush, OFFLINE_QUEUE_KEY } from '../../src/data/offlineQueue';
import { NetworkError, ValidationError, type DataBackend } from '../../src/data/ports';
import {
  BackendProvider, queryKeys, useAddPerformances, useAdvice, useBackend, useCreateExercise, useCycleState,
  useDeleteExercise, useDeleteSession, useOfflineQueueStatus, useResetBackend, useExercises, useHistoryIndex, useOfflineQueueSync, usePerformances,
  useSaveAdvice, useSaveCoachNotes, useSaveCycleState, useSaveSession, useSessions, useUpdateExercise,
} from '../../src/data/queries';
import type { PerformanceInput } from '../../src/domain/model';
import { MemoryStorage, sequentialIds } from './helpers';

const perf = (over: Partial<PerformanceInput> = {}): PerformanceInput => ({
  exerciseId: 'e1', exerciseName: 'Bench', sessionName: 'S', reps: 5, weight: 100, rpe: 9,
  variantId: null, variantName: 'Touch and Go', serieNumber: 1, performanceDate: '2026-11-20', ...over,
});

function setup(backend: DataBackend = createMockBackend(new MemoryStorage(), { genId: sequentialIds() })) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <BackendProvider backend={backend}>{children}</BackendProvider>
    </QueryClientProvider>
  );
  const invalidated = () => invalidate.mock.calls.map((c) => c[0]?.queryKey?.[0]);
  return { client, backend, wrapper, invalidated, invalidate };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backend context', () => {
  it('useBackend throws without provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useBackend())).toThrow('Backend non configuré');
  });
});

describe('queries', () => {
  it('reads exercises, sessions, performances, advice and cycle state', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({
      ex: useExercises(), s: useSessions(), p: usePerformances(), a: useAdvice(), c: useCycleState(), idx: useHistoryIndex(),
    }), { wrapper });
    await waitFor(() => { expect(result.current.c.isSuccess && result.current.p.isSuccess).toBe(true); });
    await waitFor(() => { expect(result.current.ex.data).toHaveLength(2); });
    expect(result.current.s.data?.[0]?.cycle).toBe('A');
    expect(result.current.p.data).toHaveLength(5);
    expect(result.current.c.data).toBeNull();
    await waitFor(() => { expect(result.current.a.isSuccess).toBe(true); });
    expect(result.current.a.data).toBeNull();
    expect(result.current.idx.size).toBeGreaterThan(0);
  });

  it('useHistoryIndex is memoised on the performances data', async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(() => ({ p: usePerformances(), idx: useHistoryIndex() }), { wrapper });
    const empty = result.current.idx;
    expect(empty.size).toBe(0);
    await waitFor(() => { expect(result.current.p.isSuccess).toBe(true); });
    const first = result.current.idx;
    rerender();
    expect(result.current.idx).toBe(first);
  });

  it('useSaveCycleState saves and updates the cached state', async () => {
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => ({ c: useCycleState(), save: useSaveCycleState() }), { wrapper });
    await waitFor(() => { expect(result.current.c.isSuccess).toBe(true); });
    await act(() => result.current.save.mutateAsync({ current: 'B', startedOn: '2026-11-16', weeks: 3 }));
    await waitFor(() => { expect(result.current.c.data).toEqual({ current: 'B', startedOn: '2026-11-16', weeks: 3 }); });
    expect(invalidated()).toContain('cycleState');
  });
});

describe('mutations and invalidations', () => {
  it('useUpdateExercise invalidates sessions', async () => {
    const { wrapper, invalidated, backend } = setup();
    const [ex] = await backend.exercises.list();
    if (!ex) throw new Error('seed expected');
    const { result } = renderHook(() => useUpdateExercise(), { wrapper });
    await act(() => result.current.mutateAsync({ id: ex.id, draft: { name: 'Développé', description: '', muscleGroups: [], variants: ex.variants } }));
    expect(invalidated()).toEqual(expect.arrayContaining(['exercises', 'sessions', 'performances']));
  });

  it('create/delete exercise and coach notes invalidate exercises', async () => {
    const { wrapper, invalidated, backend } = setup();
    const { result } = renderHook(() => ({ create: useCreateExercise(), del: useDeleteExercise(), notes: useSaveCoachNotes() }), { wrapper });
    const created = await act(() => result.current.create.mutateAsync({ name: 'Curl', description: '', muscleGroups: [], variants: [] }));
    expect(created.name).toBe('Curl');
    await act(() => result.current.notes.mutateAsync({ exerciseId: created.id, notes: 'serrer' }));
    expect((await backend.exercises.list()).find((e) => e.id === created.id)?.coachNotes).toBe('serrer');
    await act(() => result.current.del.mutateAsync(created.id));
    expect(invalidated().filter((k) => k === 'exercises')).toHaveLength(3);
    expect(invalidated()).toEqual(expect.arrayContaining(['sessions', 'performances']));
  });

  it('useSaveSession creates without id, updates with id (renaming invalidates performances), useDeleteSession removes', async () => {
    const { wrapper, invalidated, backend, invalidate } = setup();
    const [ex] = await backend.exercises.list();
    if (!ex) throw new Error('seed expected');
    const { result } = renderHook(() => ({ save: useSaveSession(), del: useDeleteSession() }), { wrapper });
    const draft = { name: 'B1', cycle: 'B' as const, exercises: [{ exerciseId: ex.id, series: 3 }] };
    const s = await act(() => result.current.save.mutateAsync({ draft }));
    expect(s.cycle).toBe('B');
    expect(invalidated()).toEqual(['sessions']);
    invalidate.mockClear();
    const renamed = await act(() => result.current.save.mutateAsync({ id: s.id, draft: { ...draft, name: 'B2' } }));
    expect(renamed.name).toBe('B2');
    expect(invalidated()).toEqual(expect.arrayContaining(['sessions', 'performances']));
    await act(() => result.current.del.mutateAsync(s.id));
    expect((await backend.sessions.list()).some((x) => x.id === s.id)).toBe(false);
  });

  it('useSaveAdvice stores the advice', async () => {
    const { wrapper, backend } = setup();
    const { result } = renderHook(() => ({ a: useAdvice(), save: useSaveAdvice() }), { wrapper });
    await act(() => result.current.save.mutateAsync({ training: 't', nutrition: 'n', sleep: 's' }));
    expect(await backend.advice.get()).toEqual({ training: 't', nutrition: 'n', sleep: 's' });
    await waitFor(() => { expect(result.current.a.data).toEqual({ training: 't', nutrition: 'n', sleep: 's' }); });
  });
});

describe('useAddPerformances (D7/D8)', () => {
  it('writes and reports the real count, then invalidates performances', async () => {
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useAddPerformances(), { wrapper });
    const res = await act(() => result.current.mutateAsync([perf(), perf({ serieNumber: 2, reps: 0, weight: null })]));
    expect(res).toEqual({ written: 1, queued: false });
    expect(invalidated()).toContain('performances');
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });

  it('queues on NetworkError and not on ValidationError', async () => {
    const backend = createMockBackend(new MemoryStorage());
    const add = vi.spyOn(backend.performances, 'add').mockRejectedValueOnce(new NetworkError('offline'));
    const { wrapper } = setup(backend);
    const { result } = renderHook(() => useAddPerformances(), { wrapper });
    const res = await act(() => result.current.mutateAsync([perf()]));
    expect(res).toEqual({ written: 0, queued: true });
    expect(JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? '[]')).toEqual([{ createdAt: expect.any(String) as string, payload: [perf()] }]);

    localStorage.clear();
    add.mockRejectedValueOnce(new ValidationError('Entrée performance invalide'));
    await act(async () => {
      await expect(result.current.mutateAsync([perf()])).rejects.toBeInstanceOf(ValidationError);
    });
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();

    add.mockRejectedValueOnce(new Error('permission denied'));
    await act(async () => {
      await expect(result.current.mutateAsync([perf()])).rejects.toThrow('permission denied');
    });
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });
});

describe('useAddPerformances storage failure', () => {
  it('rejects (no queued:true) when the offline queue cannot be written', async () => {
    const backend = createMockBackend(new MemoryStorage());
    vi.spyOn(backend.performances, 'add').mockRejectedValueOnce(new NetworkError('offline'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const { wrapper } = setup(backend);
    const { result } = renderHook(() => useAddPerformances(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync([perf()])).rejects.toThrow('QuotaExceededError');
    });
  });
});

describe('useOfflineQueueStatus', () => {
  it('reports pending/failed/corrupt, refreshed after flush and on the storage event', async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ createdAt: 'x', payload: [perf({ exerciseId: 'q9' })] }]));
    const { result } = renderHook(() => useOfflineQueueStatus());
    expect(result.current).toEqual({ pending: 1, failed: 0, corrupt: false });

    await act(() => flush(createMockBackend(new MemoryStorage()).performances));
    expect(result.current).toEqual({ pending: 0, failed: 0, corrupt: false });

    localStorage.setItem(OFFLINE_QUEUE_KEY, '{oops');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: OFFLINE_QUEUE_KEY })); });
    expect(result.current).toEqual({ pending: 1, failed: 0, corrupt: true });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    act(() => { enqueue([perf()]); });
    expect(result.current).toEqual({ pending: 1, failed: 1, corrupt: false });
  });
});

describe('useResetBackend', () => {
  it('resets the mock data and refetches the queries', async () => {
    const storage = new MemoryStorage();
    const backend = createMockBackend(storage);
    await backend.exercises.create({ name: 'Temp', description: '', muscleGroups: [], variants: [] });
    const { wrapper } = setup(backend);
    const { result } = renderHook(() => ({ ex: useExercises(), reset: useResetBackend() }), { wrapper });
    await waitFor(() => { expect(result.current.ex.data).toHaveLength(3); });
    await act(() => result.current.reset.mutateAsync());
    await waitFor(() => { expect(result.current.ex.data).toHaveLength(2); });
  });

  it('rejects when the backend cannot be reset (Supabase)', async () => {
    const backend = createMockBackend(new MemoryStorage());
    const { wrapper } = setup({ ...backend, reset: undefined });
    const { result } = renderHook(() => useResetBackend(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('mode mock');
    });
  });
});

describe('useOfflineQueueSync', () => {
  it('flushes on mount and invalidates performances', async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ createdAt: 'x', payload: [perf({ exerciseId: 'q1' })] }]));
    const { wrapper, invalidated, backend } = setup();
    renderHook(() => { useOfflineQueueSync(); }, { wrapper });
    await waitFor(() => { expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull(); });
    expect((await backend.performances.list()).some((p) => p.exerciseId === 'q1')).toBe(true);
    await waitFor(() => { expect(invalidated()).toContain('performances'); });
  });

  it('online event triggers flush; listener removed on unmount', async () => {
    const backend = createMockBackend(new MemoryStorage());
    const add = vi.spyOn(backend.performances, 'add');
    const { wrapper, invalidated } = setup(backend);
    const { unmount } = renderHook(() => { useOfflineQueueSync(); }, { wrapper });
    await waitFor(() => { expect(add).not.toHaveBeenCalled(); });
    expect(invalidated()).not.toContain('performances');

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ createdAt: 'x', payload: [perf({ exerciseId: 'q2' })] }]));
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => { expect(add).toHaveBeenCalledTimes(1); });
    await waitFor(() => { expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull(); });

    unmount();
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ createdAt: 'y', payload: [perf({ exerciseId: 'q3' })] }]));
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 20));
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('exposes stable query keys', () => {
    expect(queryKeys.cycleState).toEqual(['cycleState']);
  });
});
