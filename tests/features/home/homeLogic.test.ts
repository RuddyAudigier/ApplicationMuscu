import { describe, expect, it } from 'vitest';
import type { Performance, Session } from '@/domain/model';
import { buildHistoryIndex, classify, findPreviousBest } from '@/domain/records';
import { latestPrs, relativeDay, sessionOfDay, weekSegments, weekStart } from '@/features/home/homeLogic';

const session = (id: string, name: string, cycle: 'A' | 'B' | null, createdAt = '2026-01-01T00:00:00Z'): Session => ({
  id, name, cycle, createdAt, exercises: [{ exerciseId: 'e1', name: 'Squat', series: 3 }],
});

let n = 0;
const perf = (over: Partial<Performance>): Performance => ({
  id: `p${String((n += 1))}`, exerciseId: 'e1', exerciseName: 'Squat', sessionName: 'A1',
  reps: 5, weight: 100, rpe: 9, variantId: null, variantName: 'Touch and Go', serieNumber: 1,
  performanceDate: '2026-11-01', createdAt: null, ...over,
});

describe('weekStart', () => {
  it('renvoie le lundi de la semaine', () => {
    expect(weekStart('2026-11-26')).toBe('2026-11-23');
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
  });
});

describe('sessionOfDay', () => {
  // Ordre Programme : createdAt puis id (pas le nom).
  const sessions = [
    session('b', 'Jambes', 'A', '2026-01-02T00:00:00Z'),
    session('a', 'Haut', 'A', '2026-01-02T00:00:00Z'),
    session('z', 'Dos', 'A', '2026-01-01T00:00:00Z'),
    session('3', 'B1', 'B'),
    session('4', 'X', null),
  ];

  it('prend la première séance du cycle (ordre Programme) non faite cette semaine, avec son code', () => {
    expect(sessionOfDay(sessions, 'A', [], '2026-11-26')).toMatchObject({ kind: 'next', code: 'A1', session: { name: 'Dos' } });
    const done = [perf({ sessionName: 'Dos', performanceDate: '2026-11-24' })];
    expect(sessionOfDay(sessions, 'A', done, '2026-11-26')).toMatchObject({ kind: 'next', code: 'A2', session: { name: 'Haut' } });
    const two = [...done, perf({ sessionName: 'Haut', performanceDate: '2026-11-25' })];
    expect(sessionOfDay(sessions, 'A', two, '2026-11-26')).toMatchObject({ code: 'A3', session: { name: 'Jambes' } });
  });

  it('ignore les séances faites avant lundi', () => {
    const old = [perf({ sessionName: 'Dos', performanceDate: '2026-11-22' })];
    expect(sessionOfDay(sessions, 'A', old, '2026-11-26')).toMatchObject({ code: 'A1', session: { name: 'Dos' } });
  });

  it('signale une semaine bouclée ou un cycle vide', () => {
    const all = [perf({ sessionName: 'B1', performanceDate: '2026-11-25' })];
    expect(sessionOfDay(sessions, 'B', all, '2026-11-26')).toEqual({ kind: 'all-done', cycle: 'B' });
    expect(sessionOfDay([session('4', 'X', null)], 'A', [], '2026-11-26')).toEqual({ kind: 'no-cycle-session', cycle: 'A' });
  });
});

describe('weekSegments', () => {
  it('découpe bloc passé, bloc en cours et bloc suivant en semaines', () => {
    const segs = weekSegments({ current: 'A', startedOn: '2026-11-16', weeks: 2 }, '2026-11-26', 2);
    expect(segs.map((s) => `${s.cycle}:${s.status}`)).toEqual([
      'B:past', 'B:past', 'A:current', 'A:current', 'B:future', 'B:future',
    ]);
    expect(segs[2]?.fill).toBe(1);
    expect(segs[3]?.fill).toBeCloseTo(3 / 7);
    expect(segs[4]?.fill).toBe(0);
  });

  it('affiche 3 semaines pour un cycle prolongé', () => {
    const segs = weekSegments({ current: 'B', startedOn: '2026-11-23', weeks: 3 }, '2026-11-23', 3);
    expect(segs.filter((s) => s.status === 'current')).toHaveLength(3);
    expect(segs.every((s) => s.status !== 'current' || s.fill === 0)).toBe(true);
  });
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

describe('relativeDay', () => {
  it('formate selon la distance', () => {
    expect(relativeDay('2026-11-26', '2026-11-26')).toBe('aujourd’hui');
    expect(relativeDay('2026-11-25', '2026-11-26')).toBe('hier');
    expect(relativeDay('2026-11-23', '2026-11-26')).toBe('lundi');
    expect(relativeDay('2026-11-10', '2026-11-26')).toBe('10/11');
  });
});
