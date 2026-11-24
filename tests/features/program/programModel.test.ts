import { describe, expect, it } from 'vitest';
import type { CycleState, Performance, Session } from '@/domain/model';
import {
  durationHint,
  isDuplicateName,
  lastDoneLabel,
  lastDoneOn,
  revertSwitchesNow,
  seriesLabel,
  sessionsOfCycle,
  tabCaption,
  upcomingHint,
  withCycleWeeks,
} from '@/features/program/programModel';

const state: CycleState = { current: 'A', startedOn: '2026-11-20', weeks: 2 };
const today = '2026-11-23';

const session = (id: string, cycle: Session['cycle'], createdAt: string): Session => ({
  id, name: id, createdAt, cycle, exercises: [],
});

describe('programModel', () => {
  it('seriesLabel : N−1 à N séries', () => {
    expect(seriesLabel(3)).toBe('2–3 séries');
    expect(seriesLabel(2)).toBe('1–2 séries');
    expect(seriesLabel(1)).toBe('1 série');
  });

  it('sessionsOfCycle filtre et trie du plus ancien au plus récent', () => {
    const list = [session('b', 'A', '2026-02'), session('x', 'B', '2026-01'), session('a', 'A', '2026-01'), session('n', null, '2026-01')];
    expect(sessionsOfCycle(list, 'A').map((s) => s.id)).toEqual(['a', 'b']);
    expect(sessionsOfCycle(list, null).map((s) => s.id)).toEqual(['n']);
  });

  it('sessionsOfCycle départage par id à date égale', () => {
    const list = [session('z', 'A', '2026-01'), session('m', 'A', '2026-01')];
    expect(sessionsOfCycle(list, 'A').map((s) => s.id)).toEqual(['m', 'z']);
  });

  it('isDuplicateName : même cycle, sans casse ni accents, hors séance elle-même', () => {
    const list = [{ ...session('1', 'A', '2026-01'), name: 'Haut du Corps' }, { ...session('2', 'B', '2026-01'), name: 'Bas' }];
    expect(isDuplicateName(list, '  haut du corps ', 'A', null)).toBe(true);
    expect(isDuplicateName(list, 'Haut du corps', 'B', null)).toBe(false);
    expect(isDuplicateName(list, 'Haut du corps', 'A', '1')).toBe(false);
    expect(isDuplicateName([{ ...session('3', 'A', '2026-01'), name: 'Épaules' }], 'epaules', 'A', null)).toBe(true);
  });

  it('revertSwitchesNow seulement en 3e semaine d’un bloc prolongé', () => {
    expect(revertSwitchesNow({ current: 'A', startedOn: '2026-11-09', weeks: 3 }, today)).toBe(true);
    expect(revertSwitchesNow({ current: 'A', startedOn: '2026-11-16', weeks: 3 }, today)).toBe(false);
    expect(revertSwitchesNow(state, today)).toBe(false);
  });

  it('withCycleWeeks prolonge puis revient au standard', () => {
    const extended = withCycleWeeks(state, today, 3);
    expect(extended).toEqual({ current: 'A', startedOn: '2026-11-20', weeks: 3 });
    expect(withCycleWeeks(extended, today, 2)).toEqual(state);
  });

  it('lastDoneOn / lastDoneLabel', () => {
    const perfs = [
      { sessionName: 'S', performanceDate: '2026-11-20' },
      { sessionName: 'S', performanceDate: '2026-11-21' },
      { sessionName: 'T', performanceDate: '2026-11-23' },
    ] as Performance[];
    expect(lastDoneOn(perfs, 'S')).toBe('2026-11-21');
    expect(lastDoneOn(perfs, 'Z')).toBeNull();
    expect(lastDoneLabel(null, today)).toBeNull();
    expect(lastDoneLabel('2026-11-23', today)).toEqual({ isToday: true, label: 'Aujourd’hui' });
    expect(lastDoneLabel('2026-11-22', today)).toEqual({ isToday: false, label: 'Hier' });
    expect(lastDoneLabel('2026-11-21', today)).toEqual({ isToday: false, label: 'il y a 2 j' });
  });

  it('tabCaption : en cours ou dans N j', () => {
    expect(tabCaption(state, today, 'A')).toBe('En cours');
    expect(tabCaption(state, today, 'B')).toBe('dans 11 j');
  });

  it('durationHint selon la durée', () => {
    expect(durationHint(state, today)).toContain('Mêmes muscles que B');
    expect(durationHint({ ...state, weeks: 3 }, today)).toBe(
      'Semaine manquée : A est prolongé d’une semaine. B commence dans 18 jours, puis l’alternance reprend à 2 semaines.',
    );
    expect(durationHint({ current: 'A', startedOn: '2026-11-03', weeks: 3 }, today)).toContain('dans 1 jour.');
    expect(durationHint({ current: 'A', startedOn: '2026-11-09', weeks: 3 }, today)).toBe(
      'Dernière semaine du cycle A prolongé : B commence dans 7 jours. Revenir à 2 semaines fait basculer vers B maintenant.',
    );
  });

  it('upcomingHint pour l’autre cycle', () => {
    expect(upcomingHint(state, today, 'B')).toBe('B commence dans 11 jours, pour 2 semaines. Seul le cycle en cours peut être prolongé.');
    expect(upcomingHint({ current: 'A', startedOn: '2026-11-10', weeks: 2 }, today, 'B')).toContain('dans 1 jour,');
  });
});
