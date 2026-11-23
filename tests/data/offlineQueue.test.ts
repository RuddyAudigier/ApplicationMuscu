import type { Mock } from 'vitest';
import { enqueue, flush, OFFLINE_QUEUE_KEY, pendingCount } from '../../src/data/offlineQueue';
import { NetworkError, ValidationError, type PerformancesRepo } from '../../src/data/ports';
import type { PerformanceInput } from '../../src/domain/model';
import { MemoryStorage } from './helpers';

const perf = (serieNumber: number): PerformanceInput => ({
  exerciseId: 'e1', exerciseName: 'Bench', sessionName: 'S', reps: 5, weight: 100, rpe: 9,
  variantId: null, variantName: 'Touch and Go', serieNumber, performanceDate: '2026-11-20',
});

const queued = (storage: Storage): { createdAt: string; payload: PerformanceInput[] }[] =>
  JSON.parse(storage.getItem(OFFLINE_QUEUE_KEY) ?? '[]') as { createdAt: string; payload: PerformanceInput[] }[];

function repo(add: PerformancesRepo['add']): { list: PerformancesRepo['list']; add: Mock<PerformancesRepo['add']> } {
  return { list: () => Promise.resolve([]), add: vi.fn(add) };
}

describe('offline queue', () => {
  it('enqueue appends batches in the legacy format', () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage, new Date('2026-11-20T10:00:00Z'));
    enqueue([perf(2)], storage, new Date('2026-11-20T10:05:00Z'));
    expect(queued(storage)).toEqual([
      { createdAt: '2026-11-20T10:00:00.000Z', payload: [perf(1)] },
      { createdAt: '2026-11-20T10:05:00.000Z', payload: [perf(2)] },
    ]);
    expect(pendingCount(storage)).toBe(2);
  });

  it('flush sends entries in order and keeps failed ones', async () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage);
    enqueue([perf(2)], storage);
    enqueue([perf(3)], storage);
    const r = repo((inputs) => (inputs[0]?.serieNumber === 2 ? Promise.reject(new Error('boom')) : Promise.resolve({ written: 1 })));
    expect(await flush(r, storage)).toEqual({ sent: 2, remaining: 1 });
    expect(r.add.mock.calls.map((c) => c[0][0]?.serieNumber)).toEqual([1, 2, 3]);
    expect(queued(storage).map((e) => e.payload[0]?.serieNumber)).toEqual([2]);
  });

  it('stops at the first network error and keeps the rest', async () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage);
    enqueue([perf(2)], storage);
    const r = repo(() => Promise.reject(new NetworkError('offline')));
    expect(await flush(r, storage)).toEqual({ sent: 0, remaining: 2 });
    expect(r.add).toHaveBeenCalledTimes(1);
  });

  it('removes the key when everything is sent; empty queue sends nothing', async () => {
    const storage = new MemoryStorage();
    const r = repo(() => Promise.resolve({ written: 1 }));
    expect(await flush(r, storage)).toEqual({ sent: 0, remaining: 0 });
    enqueue([perf(1)], storage);
    expect(await flush(r, storage)).toEqual({ sent: 1, remaining: 0 });
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });

  it('flush does not duplicate an entry already sent', async () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage);
    enqueue([perf(2)], storage);
    const seenOnSecond: number[] = [];
    const r = repo((inputs) => {
      // Au moment d'envoyer la 2e entrée, la 1re doit déjà avoir quitté la file.
      if (inputs[0]?.serieNumber === 2) seenOnSecond.push(...queued(storage).map((e) => e.payload[0]?.serieNumber ?? 0));
      return Promise.resolve({ written: 1 });
    });
    await flush(r, storage);
    expect(seenOnSecond).toEqual([2]);
    // Deux flush concurrents (montage + `online`) n'envoient chaque entrée qu'une fois.
    enqueue([perf(3)], storage);
    r.add.mockClear();
    await Promise.all([flush(r, storage), flush(r, storage)]);
    expect(r.add).toHaveBeenCalledTimes(1);
  });

  it('keeps entries enqueued while a flush is running', async () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage);
    const r = repo(() => {
      enqueue([perf(9)], storage);
      return Promise.resolve({ written: 1 });
    });
    expect(await flush(r, storage)).toEqual({ sent: 1, remaining: 1 });
    expect(queued(storage).map((e) => e.payload[0]?.serieNumber)).toEqual([9]);
  });

  it('drops empty legacy entries and keeps entries rejected by validation', async () => {
    const storage = new MemoryStorage();
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ createdAt: 'x', payload: [] }, { createdAt: 'y', payload: [perf(1)] }]));
    const r = repo(() => Promise.reject(new ValidationError('bad')));
    expect(await flush(r, storage)).toEqual({ sent: 0, remaining: 1 });
    expect(r.add).toHaveBeenCalledTimes(1);
  });

  it('keeps an unreadable queue aside instead of losing new entries', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem(OFFLINE_QUEUE_KEY, '{oops');
    const r = repo(() => Promise.resolve({ written: 1 }));
    expect(await flush(r, storage)).toEqual({ sent: 0, remaining: 0 });
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toBe('{oops');
    enqueue([perf(1)], storage);
    expect(queued(storage)).toHaveLength(1);
    expect(storage.getItem(`${OFFLINE_QUEUE_KEY}_corrupt`)).toBe('{oops');
    expect(error).toHaveBeenCalled();
  });
});
