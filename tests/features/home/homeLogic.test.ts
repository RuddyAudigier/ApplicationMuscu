import { describe, expect, it } from 'vitest';
import type { Performance, Session } from '@/domain/model';
import { nextPlannedSession, relativeDay, weekSegments, weekStart } from '@/features/home/homeLogic';

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

describe('nextPlannedSession', () => {
  // Ordre Programme : createdAt puis id (pas le nom).
  const sessions = [
    session('b', 'Jambes', 'A', '2026-01-02T00:00:00Z'),
    session('a', 'Haut', 'A', '2026-01-02T00:00:00Z'),
    session('z', 'Dos', 'A', '2026-01-01T00:00:00Z'),
    session('3', 'B1', 'B'),
    session('4', 'X', null),
  ];

  it('prend la première séance du cycle (ordre Programme) non faite cette semaine, avec son code', () => {
    expect(nextPlannedSession(sessions, 'A', [], '2026-11-26')).toMatchObject({ kind: 'next', code: 'A1', session: { name: 'Dos' } });
    const done = [perf({ sessionName: 'Dos', performanceDate: '2026-11-24' })];
    expect(nextPlannedSession(sessions, 'A', done, '2026-11-26')).toMatchObject({ kind: 'next', code: 'A2', session: { name: 'Haut' } });
    const two = [...done, perf({ sessionName: 'Haut', performanceDate: '2026-11-25' })];
    expect(nextPlannedSession(sessions, 'A', two, '2026-11-26')).toMatchObject({ code: 'A3', session: { name: 'Jambes' } });
  });

  it('ignore les séances faites avant lundi', () => {
    const old = [perf({ sessionName: 'Dos', performanceDate: '2026-11-22' })];
    expect(nextPlannedSession(sessions, 'A', old, '2026-11-26')).toMatchObject({ code: 'A1', session: { name: 'Dos' } });
  });

  it('saute les séances sans exercice (le code reste le rang Programme)', () => {
    const empty: Session = { ...session('e', 'Vide', 'A', '2026-01-01T00:00:00Z'), exercises: [] };
    const withEmpty = [empty, session('f', 'Pleine', 'A', '2026-01-02T00:00:00Z')];
    expect(nextPlannedSession(withEmpty, 'A', [], '2026-11-26')).toMatchObject({ kind: 'next', code: 'A2', session: { name: 'Pleine' } });
    expect(nextPlannedSession([empty], 'A', [], '2026-11-26')).toEqual({ kind: 'no-cycle-session', cycle: 'A' });
  });

  it('signale une semaine bouclée ou un cycle vide', () => {
    const all = [perf({ sessionName: 'B1', performanceDate: '2026-11-25' })];
    expect(nextPlannedSession(sessions, 'B', all, '2026-11-26')).toEqual({ kind: 'all-done', cycle: 'B' });
    expect(nextPlannedSession([session('4', 'X', null)], 'A', [], '2026-11-26')).toEqual({ kind: 'no-cycle-session', cycle: 'A' });
  });
});

describe('weekSegments', () => {
  it('part de la semaine en cours : 1re semaine de A → A A B B A A', () => {
    const segs = weekSegments({ current: 'A', startedOn: '2026-11-23', weeks: 2 }, '2026-11-26');
    expect(segs.map((s) => `${s.cycle}:${s.status}`)).toEqual([
      'A:current', 'A:future', 'B:future', 'B:future', 'A:future', 'A:future',
    ]);
  });

  it('2e semaine de A → un seul A, surligné', () => {
    const segs = weekSegments({ current: 'A', startedOn: '2026-11-16', weeks: 2 }, '2026-11-26');
    expect(segs.map((s) => `${s.cycle}:${s.status}`)).toEqual([
      'A:current', 'B:future', 'B:future', 'A:future', 'A:future', 'B:future',
    ]);
  });

  it('cycle prolongé à 3 semaines : 3 A en 1re semaine', () => {
    const segs = weekSegments({ current: 'B', startedOn: '2026-11-23', weeks: 3 }, '2026-11-23');
    expect(segs.filter((s) => s.cycle === 'B').slice(0, 3).map((s) => s.status)).toEqual(['current', 'future', 'future']);
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
