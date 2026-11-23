import type { Mock } from 'vitest';
import {
  enqueue, failedCount, flush, OFFLINE_QUEUE_CORRUPT_KEY, OFFLINE_QUEUE_FAILED_KEY, OFFLINE_QUEUE_KEY, pendingCount,
} from '../../src/data/offlineQueue';
import { NetworkError, ValidationError, type PerformancesRepo } from '../../src/data/ports';
import type { PerformanceInput } from '../../src/domain/model';
import { MemoryStorage } from './helpers';

const perf = (serieNumber: number): PerformanceInput => ({
  exerciseId: 'e1', exerciseName: 'Bench', sessionName: 'S', reps: 5, weight: 100, rpe: 9,
  variantId: null, variantName: 'Touch and Go', serieNumber, performanceDate: '2026-11-20',
});

interface Batch { createdAt: string; payload: PerformanceInput[] }
const queued = (storage: Storage, key = OFFLINE_QUEUE_KEY): Batch[] =>
  JSON.parse(storage.getItem(key) ?? '[]') as Batch[];

function repo(add: PerformancesRepo['add']): { list: PerformancesRepo['list']; add: Mock<PerformancesRepo['add']> } {
  return { list: () => Promise.resolve([]), add: vi.fn(add) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
    expect(failedCount(storage)).toBe(0);
  });

  it('enqueue throws when the storage refuses the write (no silent loss)', () => {
    const storage = new MemoryStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => { enqueue([perf(1)], storage); }).toThrow('QuotaExceededError');
    const unreadable = new MemoryStorage();
    vi.spyOn(unreadable, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(() => { enqueue([perf(1)], unreadable); }).toThrow('SecurityError');
  });

  it('flush sends entries in order; a non-network failure moves the batch to the failed list', async () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage);
    enqueue([perf(2)], storage);
    enqueue([perf(3)], storage);
    const r = repo((inputs) => (inputs[0]?.serieNumber === 2 ? Promise.reject(new ValidationError('bad')) : Promise.resolve({ written: 1 })));
    expect(await flush(r, storage)).toEqual({ sent: 2, remaining: 0, failed: 1, corrupt: false });
    expect(r.add.mock.calls.map((c) => c[0][0]?.serieNumber)).toEqual([1, 2, 3]);
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
    const failed = JSON.parse(storage.getItem(OFFLINE_QUEUE_FAILED_KEY) ?? '[]') as (Batch & { error: string })[];
    expect(failed).toEqual([expect.objectContaining({ payload: [perf(2)], error: 'bad' })]);
    expect(failedCount(storage)).toBe(1);

    // Ajout en fin, jamais d'écrasement.
    enqueue([perf(4)], storage);
    await flush(repo(() => Promise.reject(new Error('23503 fk'))), storage);
    expect(queued(storage, OFFLINE_QUEUE_FAILED_KEY).map((b) => b.payload[0]?.serieNumber)).toEqual([2, 4]);
  });

  it('keeps the batch in the queue when the failed list cannot be written', async () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage);
    const set = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((k, v) => {
      if (k === OFFLINE_QUEUE_FAILED_KEY) throw new Error('full');
      set(k, v);
    });
    await expect(flush(repo(() => Promise.reject(new Error('boom'))), storage)).rejects.toThrow('full');
    expect(queued(storage)).toHaveLength(1);
  });

  it('stops at the first network error and keeps the rest', async () => {
    const storage = new MemoryStorage();
    enqueue([perf(1)], storage);
    enqueue([perf(2)], storage);
    const r = repo(() => Promise.reject(new NetworkError('offline')));
    expect(await flush(r, storage)).toEqual({ sent: 0, remaining: 2, failed: 0, corrupt: false });
    expect(r.add).toHaveBeenCalledTimes(1);
  });

  it('removes the key when everything is sent; empty queue sends nothing', async () => {
    const storage = new MemoryStorage();
    const r = repo(() => Promise.resolve({ written: 1 }));
    expect(await flush(r, storage)).toEqual({ sent: 0, remaining: 0, failed: 0, corrupt: false });
    enqueue([perf(1)], storage);
    expect(await flush(r, storage)).toEqual({ sent: 1, remaining: 0, failed: 0, corrupt: false });
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
    expect(await flush(r, storage)).toEqual({ sent: 1, remaining: 1, failed: 0, corrupt: false });
    expect(queued(storage).map((e) => e.payload[0]?.serieNumber)).toEqual([9]);
  });

  it('drops empty legacy entries', async () => {
    const storage = new MemoryStorage();
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ createdAt: 'x', payload: [] }, { createdAt: 'y', payload: [perf(1)] }]));
    const r = repo(() => Promise.resolve({ written: 1 }));
    expect(await flush(r, storage)).toEqual({ sent: 1, remaining: 0, failed: 0, corrupt: false });
    expect(r.add).toHaveBeenCalledTimes(1);
  });

  it('reports an unreadable queue and never overwrites it without preserving it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem(OFFLINE_QUEUE_KEY, '{oops');
    const r = repo(() => Promise.resolve({ written: 1 }));
    expect(await flush(r, storage)).toEqual({ sent: 0, remaining: 1, failed: 0, corrupt: true });
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toBe('{oops');
    expect(pendingCount(storage)).toBeGreaterThanOrEqual(1);

    enqueue([perf(1)], storage);
    expect(queued(storage)).toHaveLength(1);
    expect(JSON.parse(storage.getItem(OFFLINE_QUEUE_CORRUPT_KEY) ?? '[]')).toEqual(['{oops']);
    expect(failedCount(storage)).toBe(1);

    // Une 2e file illisible est ajoutée, pas substituée.
    storage.setItem(OFFLINE_QUEUE_KEY, '[{"bad"');
    enqueue([perf(2)], storage);
    expect(JSON.parse(storage.getItem(OFFLINE_QUEUE_CORRUPT_KEY) ?? '[]')).toEqual(['{oops', '[{"bad"']);
    expect(error).toHaveBeenCalled();
  });

  it('refuses to enqueue when the unreadable queue cannot be preserved', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem(OFFLINE_QUEUE_KEY, '{oops');
    const set = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((k, v) => {
      if (k === OFFLINE_QUEUE_CORRUPT_KEY) throw new Error('full');
      set(k, v);
    });
    expect(() => { enqueue([perf(1)], storage); }).toThrow('full');
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toBe('{oops');
  });

  it('keeps an unreadable archive entry when appending to it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem(OFFLINE_QUEUE_CORRUPT_KEY, 'not json');
    storage.setItem(OFFLINE_QUEUE_KEY, '{oops');
    enqueue([perf(1)], storage);
    expect(JSON.parse(storage.getItem(OFFLINE_QUEUE_CORRUPT_KEY) ?? '[]')).toEqual(['not json', '{oops']);
  });
});
