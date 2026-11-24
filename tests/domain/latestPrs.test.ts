import { describe, expect, it } from 'vitest';
import type { Performance } from '@/domain/model';
import { buildHistoryIndex, classify, findPreviousBest, latestPrs } from '@/domain/records';

let n = 0;
const perf = (over: Partial<Performance>): Performance => ({
  id: `p${String((n += 1))}`, exerciseId: 'e1', exerciseName: 'Squat', sessionName: 'A1',
  reps: 5, weight: 100, rpe: 9, variantId: null, variantName: 'Touch and Go', serieNumber: 1,
  performanceDate: '2026-11-01', createdAt: null, ...over,
});

describe('latestPrs', () => {
  it('renvoie les PR les plus récents avec leur type', () => {
    const perfs = [
      perf({ reps: 5, weight: 100, performanceDate: '2026-11-01' }),
      perf({ reps: 5, weight: 105, performanceDate: '2026-11-03' }),
      perf({ reps: 6, weight: 105, performanceDate: '2026-11-05' }),
      perf({ reps: 5, weight: 90, performanceDate: '2026-11-07' }),
      perf({ reps: 8, weight: 110, performanceDate: '2026-11-09' }),
      perf({ reps: 0, weight: 200, performanceDate: '2026-11-10' }),
      perf({ reps: 3, weight: null, performanceDate: '2026-11-10' }),
      perf({ performanceDate: 'pas une date' }),
    ];
    const prs = latestPrs(perfs);
    expect(prs.map((p) => `${p.date}:${p.kind}`)).toEqual([
      '2026-11-09:hybride', '2026-11-05:reps', '2026-11-03:charge',
    ]);
    expect(latestPrs(perfs, 1)).toHaveLength(1);
  });

  it('ne compte pas la première série comme un PR', () => {
    const perfs = [perf({})];
    expect(latestPrs(perfs)).toEqual([]);
  });
});

/** Référence : règle du domaine appliquée ligne par ligne (O(n²), petits jeux seulement). */
function naivePrs(perfs: Performance[]) {
  const index = buildHistoryIndex(perfs);
  return perfs.flatMap((p) => {
    if (p.weight === null || p.reps <= 0) return [];
    const c = classify({ reps: p.reps, weight: p.weight }, findPreviousBest(index, p.exerciseId, p));
    if (c.improvementStatus !== 'improved') return [];
    return [`${p.id}:${c.isHybridPr ? 'hybride' : c.isRepsPr ? 'reps' : 'charge'}`];
  }).sort();
}

describe('latestPrs : équivalence et passage à l’échelle', () => {
  it('donne les mêmes PR que findPreviousBest + classify', () => {
    let seed = 42;
    const rnd = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const perfs: Performance[] = [];
    for (let i = 0; i < 400; i += 1) {
      const day = 1 + Math.floor(rnd() * 28);
      perfs.push(perf({
        exerciseId: rnd() < 0.5 ? 'e1' : 'e2',
        exerciseName: rnd() < 0.5 ? 'Squat' : 'Squat',
        variantName: rnd() < 0.7 ? 'Touch and Go' : 'Pause',
        reps: 1 + Math.floor(rnd() * 8),
        weight: 80 + Math.round(rnd() * 8) * 2.5,
        performanceDate: `2026-10-${String(day).padStart(2, '0')}`,
        createdAt: rnd() < 0.5 ? `2026-10-${String(day).padStart(2, '0')}T1${String(Math.floor(rnd() * 10))}:00:00` : null,
      }));
    }
    const fast = latestPrs(perfs, Infinity).map((p) => `${p.key}:${p.kind}`).sort();
    expect(fast).toEqual(naivePrs(perfs));
  });

  it('reste équivalent avec des charges à ε près, des répétitions identiques et plusieurs variantes', () => {
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const variants = [
      { variantId: null, variantName: 'Touch and Go' },
      { variantId: 'v1', variantName: 'Pause' },
      { variantId: null, variantName: 'pause' },
      { variantId: 'v2', variantName: 'Pause' },
    ];
    const perfs: Performance[] = [];
    for (let i = 0; i < 500; i += 1) {
      const day = String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
      const v = variants[Math.floor(rnd() * variants.length)] ?? variants[0];
      perfs.push(perf({
        ...v,
        reps: 1 + Math.floor(rnd() * 5),
        weight: 100 + Math.floor(rnd() * 5) * 0.005 + Math.floor(rnd() * 3) * 2.5,
        performanceDate: `2026-10-${day}`,
        createdAt: rnd() < 0.5 ? `2026-10-${day}T1${String(Math.floor(rnd() * 3))}:00:00` : null,
      }));
    }
    expect(latestPrs(perfs, Infinity).map((p) => `${p.key}:${p.kind}`).sort()).toEqual(naivePrs(perfs));
  });

  it('compte « plus de reps à charge égale » comme un PR reps', () => {
    const perfs = [
      perf({ reps: 3, weight: 100, performanceDate: '2026-10-01' }),
      perf({ reps: 4, weight: 100, performanceDate: '2026-10-02' }),
    ];
    expect(latestPrs(perfs).map((p) => p.kind)).toEqual(['reps']);
  });

  it('reste rapide sur un long historique sans PR récent', () => {
    const perfs: Performance[] = [];
    for (let i = 0; i < 20_000; i += 1) {
      const d = new Date(2020, 0, 1 + Math.floor(i / 10));
      const iso = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      perfs.push(perf({ exerciseId: `e${String(i % 5)}`, exerciseName: `Ex ${String(i % 5)}`, reps: 1 + (i % 12), weight: 200 - i / 200, performanceDate: iso }));
    }
    const t0 = performance.now();
    const prs = latestPrs(perfs);
    // Ancienne version O(n²) : plusieurs minutes ; marge large pour la couverture instrumentée.
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(prs.length).toBeLessThanOrEqual(3);
  });
});

