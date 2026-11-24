import { describe, expect, it } from 'vitest';
import { cycleOn } from '@/domain/cycles';
import type { CycleState, Session } from '@/domain/model';
import { MANUAL_SESSION, sessionCode, sessionNameForDay, sessionsOfCycle } from '@/domain/sessions';

const session = (id: string, name: string, cycle: 'A' | 'B' | null, createdAt = '2026-01-01T00:00:00Z'): Session => ({
  id, name, cycle, createdAt, exercises: [{ exerciseId: 'e1', name: 'Squat', series: 3 }],
});

describe('sessionsOfCycle / sessionCode', () => {
  it('filtre le cycle et trie par création puis id', () => {
    const list = [
      session('b', 'Jambes', 'A', '2026-01-02T00:00:00Z'),
      session('a', 'Haut', 'A', '2026-01-02T00:00:00Z'),
      session('z', 'Dos', 'A', '2026-01-01T00:00:00Z'),
      session('n', 'Libre', null),
      session('x', 'B1', 'B'),
    ];
    expect(sessionsOfCycle(list, 'A').map((s) => s.id)).toEqual(['z', 'a', 'b']);
    expect(sessionsOfCycle(list, null).map((s) => s.id)).toEqual(['n']);
  });

  it('formate le libellé de cycle', () => {
    expect(sessionCode('A')).toBe('Cycle A');
    expect(sessionCode('B')).toBe('Cycle B');
  });
});

describe('cycleOn', () => {
  const state: CycleState = { current: 'A', startedOn: '2026-11-16', weeks: 2 };
  it('résout le bloc en cours et les blocs futurs', () => {
    expect(cycleOn(state, '2026-11-16')).toBe('A');
    expect(cycleOn(state, '2026-11-29')).toBe('A');
    expect(cycleOn(state, '2026-11-30')).toBe('B');
  });
  it('remonte le passé par blocs de 2 semaines', () => {
    expect(cycleOn(state, '2026-11-15')).toBe('B');
    expect(cycleOn(state, '2026-11-02')).toBe('B');
    expect(cycleOn(state, '2026-11-01')).toBe('A');
  });
});

describe('sessionNameForDay', () => {
  const plan = {
    sessions: [session('1', 'Haut A', 'A'), session('2', 'Bas B', 'B')],
    cycleState: { current: 'A', startedOn: '2026-11-16', weeks: 2 } as CycleState,
  };
  const p = (sessionName: string, performanceDate = '2026-11-20') => ({ sessionName, performanceDate });

  it('préfère la séance prévue du cycle actif ce jour-là, même minoritaire', () => {
    const perfs = [p('Autre'), p('Autre'), p('Autre'), p(' haut a ')];
    expect(sessionNameForDay(perfs, '2026-11-20', plan)).toBe('Haut A');
  });

  it('ignore une séance d’un autre cycle que celui actif ce jour-là', () => {
    const perfs = [p('Bas B'), p('Autre'), p('Autre')];
    expect(sessionNameForDay(perfs, '2026-11-20', plan)).toBe('Autre');
    // Le 10/11, c'est le cycle B qui était actif.
    expect(sessionNameForDay([p('Bas B', '2026-11-10'), p('Autre', '2026-11-10'), p('Autre', '2026-11-10')], '2026-11-10', plan)).toBe('Bas B');
  });

  it('retombe sur le nom le plus fréquent, puis « Ajout manuel »', () => {
    const perfs = [p('X'), p('Y'), p('Y'), p(MANUAL_SESSION), p(MANUAL_SESSION), p(MANUAL_SESSION), p('Import CSV'), p('Y', '2026-11-21')];
    expect(sessionNameForDay(perfs, '2026-11-20')).toBe('Y');
    expect(sessionNameForDay(perfs, '2026-11-20', plan)).toBe('Y');
    expect(sessionNameForDay([p(MANUAL_SESSION)], '2026-11-20', plan)).toBe(MANUAL_SESSION);
    expect(sessionNameForDay([], '2026-11-20')).toBe('Ajout manuel');
  });
});
