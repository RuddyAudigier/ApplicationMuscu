import { describe, expect, it } from 'vitest';
import type { Performance, Session } from '@/domain/model';
import { buildHistoryIndex } from '@/domain/records';
import { latestPrs, relativeDay, sessionOfDay, weekSegments, weekStart } from '@/features/home/homeLogic';

const session = (id: string, name: string, cycle: 'A' | 'B' | null): Session => ({
  id, name, cycle, createdAt: '2026-01-01T00:00:00Z', exercises: [{ exerciseId: 'e1', name: 'Squat', series: 3 }],
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
  const sessions = [session('2', 'A2', 'A'), session('1', 'A1', 'A'), session('3', 'B1', 'B'), session('4', 'X', null)];

  it('prend la première séance du cycle (ordre des noms) non faite cette semaine', () => {
    expect(sessionOfDay(sessions, 'A', [], '2026-11-26')).toEqual({ kind: 'next', session: sessions[1] });
    const done = [perf({ sessionName: 'A1', performanceDate: '2026-11-24' })];
    expect(sessionOfDay(sessions, 'A', done, '2026-11-26')).toMatchObject({ kind: 'next', session: { name: 'A2' } });
  });

  it('ignore les séances faites avant lundi', () => {
    const old = [perf({ sessionName: 'A1', performanceDate: '2026-11-22' })];
    expect(sessionOfDay(sessions, 'A', old, '2026-11-26')).toMatchObject({ session: { name: 'A1' } });
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
    const prs = latestPrs(perfs, buildHistoryIndex(perfs));
    expect(prs.map((p) => `${p.date}:${p.kind}`)).toEqual([
      '2026-11-09:hybride', '2026-11-05:reps', '2026-11-03:charge',
    ]);
    expect(latestPrs(perfs, buildHistoryIndex(perfs), 1)).toHaveLength(1);
  });

  it('ne compte pas la première série comme un PR', () => {
    const perfs = [perf({})];
    expect(latestPrs(perfs, buildHistoryIndex(perfs))).toEqual([]);
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
