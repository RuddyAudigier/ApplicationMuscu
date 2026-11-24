import { describe, expect, it } from 'vitest';
import type { Performance, Variant } from '@/domain/model';
import { bestByReps, excelExport, exerciseFooter, globalStats, paretoMask } from '@/domain/perfTable';
import { buildHistoryIndex, findPreviousBest } from '@/domain/records';

let seq = 0;
const perf = (over: Partial<Performance>): Performance => ({
  id: `p${String(++seq)}`,
  exerciseId: 'bench',
  exerciseName: 'Bench',
  sessionName: 'S',
  reps: 5,
  weight: 100,
  rpe: null,
  variantId: null,
  variantName: 'Touch and Go',
  serieNumber: 1,
  performanceDate: '2026-03-01',
  createdAt: null,
  ...over,
});
const p = (reps: number, weight: number): Performance => perf({ reps, weight });
const tng: Variant = { id: null, exerciseId: 'bench', name: 'Touch and Go', isDefault: true };

describe('bestByReps', () => {
  it('returns 30 slots, max weight per reps, tie → most recent date', () => {
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-01' });
    const b = perf({ reps: 5, weight: 100, performanceDate: '2026-03-03' });
    const c = perf({ reps: 5, weight: 100, performanceDate: '2026-03-02' });
    const d = perf({ reps: 5, weight: 90, performanceDate: '2026-03-09' });
    const e = perf({ reps: 30, weight: 20 });
    const cells = bestByReps([a, b, c, d, e, perf({ reps: 0 }), perf({ reps: 31 })], tng);
    expect(cells).toHaveLength(30);
    expect(cells[4]).toBe(b);
    expect(cells[29]).toBe(e);
    expect(cells.filter(Boolean)).toHaveLength(2);
  });

  it('applies the legacy column membership rule', () => {
    const byEmptyName = perf({ variantName: '', weight: 1 });
    const byOtherCase = perf({ variantName: 'touch and go', reps: 2, weight: 1 });
    const pause = perf({ variantName: 'Pause', reps: 3, weight: 1 });
    const withIdSameName = perf({ variantId: 'v9', variantName: 'Touch and Go', reps: 4, weight: 1 });
    const cells = bestByReps([byEmptyName, byOtherCase, pause, withIdSameName], tng);
    expect(cells[4]).toBe(byEmptyName);
    // Nom normalisé (même règle que la détection de PR) : « touch and go » = « Touch and Go ».
    expect(cells[1]).toBe(byOtherCase);
    expect(cells[2]).toBeNull();
    expect(cells[3]).toBe(withIdSameName);

    const withId: Variant = { id: 'v1', exerciseId: 'bench', name: 'Pause', isDefault: false };
    const byId = perf({ variantId: 'v1', variantName: 'Renamed', reps: 6 });
    const byName = perf({ variantId: 'v2', variantName: 'Pause', reps: 7 });
    const other = perf({ variantId: 'v2', variantName: 'pause', reps: 8 });
    const cells2 = bestByReps([byId, byName, other], withId);
    expect(cells2[5]).toBe(byId);
    // Une perf portant un variantId n'est rattachée que par id, jamais par nom.
    expect(cells2[6]).toBeNull();
    expect(cells2[7]).toBeNull();
  });

  it('matches by name only when the performance has no variantId', () => {
    const pause: Variant = { id: 'v1', exerciseId: 'bench', name: 'Pause', isDefault: false };
    const legacy = perf({ variantId: null, variantName: 'Pause', reps: 3 });
    expect(bestByReps([legacy], pause)[2]).toBe(legacy);
  });

  it('agrees with findPreviousBest on legacy « pause » vs « Pause » and on rename/recreate', () => {
    const pause: Variant = { id: 'v1', exerciseId: 'bench', name: 'Pause', isDefault: false };
    const legacy = perf({ variantId: null, variantName: 'pause', reps: 5, weight: 100, performanceDate: '2026-03-01' });
    const cur = perf({ variantId: 'v1', variantName: 'Pause', reps: 5, weight: 90, performanceDate: '2026-03-04' });
    expect(bestByReps([legacy], pause)[4]).toBe(legacy);
    expect(findPreviousBest(buildHistoryIndex([legacy, cur]), 'bench', cur)).toMatchObject({ weight: 100 });

    const recreated: Variant = { id: 'v3', exerciseId: 'bench', name: 'Pause', isDefault: false };
    const old = perf({ variantId: 'v1', variantName: 'Pause', reps: 5, weight: 100, performanceDate: '2026-03-01' });
    const fresh = perf({ variantId: 'v3', variantName: 'Pause', reps: 5, weight: 90, performanceDate: '2026-03-04' });
    expect(bestByReps([old], recreated).filter(Boolean)).toEqual([]);
    expect(findPreviousBest(buildHistoryIndex([old, fresh]), 'bench', fresh)).toBeNull();
  });

  it('rename then recreate with the same name: old records stay with the old variant id', () => {
    // v1 « Pause » renommée « Pause 2 s » (relabel : ses perfs gardent v1), puis nouvelle « Pause » v3.
    const renamed: Variant = { id: 'v1', exerciseId: 'bench', name: 'Pause 2 s', isDefault: false };
    const recreated: Variant = { id: 'v3', exerciseId: 'bench', name: 'Pause', isDefault: false };
    const old = perf({ variantId: 'v1', variantName: 'Pause', reps: 5, weight: 80 });
    const fresh = perf({ variantId: 'v3', variantName: 'Pause', reps: 6, weight: 70 });
    expect(bestByReps([old, fresh], renamed).filter(Boolean)).toEqual([old]);
    expect(bestByReps([old, fresh], recreated).filter(Boolean)).toEqual([fresh]);
  });

  it('treats null weight as 0 and ignores non-finite reps', () => {
    const n = perf({ reps: 3, weight: null });
    const w = perf({ reps: 3, weight: 10 });
    expect(bestByReps([n, w, perf({ reps: Number.NaN })], tng)[2]).toBe(w);
  });
});

describe('paretoMask', () => {
  it('clears dominated cells (no epsilon)', () => {
    expect(paretoMask([p(1, 100), p(2, 100)])[0]).toBeNull();
    const cells = [p(1, 100), p(2, 99.999), null, p(4, 80)];
    const masked = paretoMask(cells);
    expect(masked[0]).toBe(cells[0]);
    expect(masked[1]).toBe(cells[1]);
    expect(masked[2]).toBeNull();
    expect(masked[3]).toBe(cells[3]);
  });

  it('clears a cell dominated on both axes', () => {
    const cells = [null, p(2, 50), p(3, 60)];
    expect(paretoMask(cells)).toEqual([null, null, cells[2]]);
  });
});

describe('excelExport', () => {
  it('produces 30 lines "{poids}\\t{date FR}"', () => {
    const cells: (Performance | null)[] = Array.from({ length: 30 }, () => null);
    cells[0] = perf({ reps: 1, weight: 92.456, performanceDate: '2026-03-05' });
    cells[2] = perf({ reps: 3, weight: null, performanceDate: '2026-03-06' });
    const out = excelExport(cells).split('\n');
    expect(out).toHaveLength(30);
    expect(out[0]).toBe('92,46\t05/03/2026');
    expect(out[1]).toBe('\t');
    expect(out[2]).toBe('\t06/03/2026');
  });
});

describe('exerciseFooter / globalStats', () => {
  it('counts sessions and best e1RM', () => {
    const perfs = [
      perf({ reps: 5, weight: 100, performanceDate: '2026-03-01' }),
      perf({ reps: 1, weight: 110, performanceDate: '2026-03-01' }),
      perf({ reps: 3, weight: null, performanceDate: '2026-03-02' }),
    ];
    expect(exerciseFooter(perfs)).toEqual({ sessions: 2, bestE1rm: 116.7 });
    expect(exerciseFooter([])).toEqual({ sessions: 0, bestE1rm: null });
  });

  it('computes global stats', () => {
    const perfs = [
      perf({ reps: 5, weight: 100.5 }),
      perf({ reps: 3, weight: null, exerciseName: 'Squat' }),
      perf({ reps: 2, weight: 50, exerciseName: 'Squat' }),
    ];
    expect(globalStats(perfs)).toEqual({ series: 3, tonnage: 602.5, reps: 10, exercises: 2 });
  });
});
