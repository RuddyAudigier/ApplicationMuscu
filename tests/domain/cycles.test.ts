import { describe, expect, it } from 'vitest';
import type { CycleState } from '@/domain/model';
import { cycleStatus, extendCycle, switchCycle, timeline } from '@/domain/cycles';

const A2: CycleState = { current: 'A', startedOn: '2026-11-02', weeks: 2 };

describe('cycleStatus', () => {
  it('first day of the block', () => {
    expect(cycleStatus(A2, '2026-11-02')).toEqual({ current: 'A', week: 1, weeks: 2, daysLeft: 14, next: 'B' });
  });

  it('second week of the block', () => {
    expect(cycleStatus(A2, '2026-11-10')).toEqual({ current: 'A', week: 2, weeks: 2, daysLeft: 6, next: 'B' });
    expect(cycleStatus(A2, '2026-11-15')).toMatchObject({ current: 'A', week: 2, daysLeft: 1 });
  });

  it('alternates to the other cycle after 2 weeks', () => {
    expect(cycleStatus(A2, '2026-11-16')).toEqual({ current: 'B', week: 1, weeks: 2, daysLeft: 14, next: 'A' });
    const b: CycleState = { current: 'B', startedOn: '2026-11-02', weeks: 2 };
    expect(cycleStatus(b, '2026-11-16')).toMatchObject({ current: 'A', next: 'B' });
  });

  it('extended block lasts 3 weeks, then 2-week alternation resumes', () => {
    const ext = extendCycle(A2);
    expect(ext).toEqual({ current: 'A', startedOn: '2026-11-02', weeks: 3 });
    expect(cycleStatus(ext, '2026-11-22')).toEqual({ current: 'A', week: 3, weeks: 3, daysLeft: 1, next: 'B' });
    expect(cycleStatus(ext, '2026-11-23')).toEqual({ current: 'B', week: 1, weeks: 2, daysLeft: 14, next: 'A' });
  });

  it('rolls forward over 5 weeks without opening the app', () => {
    // A [0,14) B [14,28) A [28,42) : jour 35 = A semaine 2.
    expect(cycleStatus(A2, '2026-12-07')).toEqual({ current: 'A', week: 2, weeks: 2, daysLeft: 7, next: 'B' });
    // Prolongé : A [0,21) B [21,35) A [35,49) : jour 35 = A semaine 1 (le bloc de 3 semaines ne compte qu'une fois).
    expect(cycleStatus(extendCycle(A2), '2026-12-07')).toEqual({ current: 'A', week: 1, weeks: 2, daysLeft: 14, next: 'B' });
  });

  it('counts calendar days across a DST change', () => {
    const s: CycleState = { current: 'B', startedOn: '2026-10-19', weeks: 2 };
    expect(cycleStatus(s, '2026-10-26')).toMatchObject({ current: 'B', week: 2, daysLeft: 7 });
    expect(cycleStatus(s, '2026-11-02')).toMatchObject({ current: 'A', week: 1, daysLeft: 14 });
  });

  it('a start in the future stays on week 1', () => {
    expect(cycleStatus(A2, '2026-10-31')).toEqual({ current: 'A', week: 1, weeks: 2, daysLeft: 16, next: 'B' });
  });
});

describe('switchCycle', () => {
  it('starts the other cycle today for 2 weeks', () => {
    expect(switchCycle(A2, '2026-11-05')).toEqual({ current: 'B', startedOn: '2026-11-05', weeks: 2 });
  });

  it('switches from the resolved current cycle when the state is stale', () => {
    expect(switchCycle(A2, '2026-11-20')).toEqual({ current: 'A', startedOn: '2026-11-20', weeks: 2 });
  });
});

describe('timeline', () => {
  it('2 past blocks, the current one and future ones (6 by default)', () => {
    expect(timeline(A2, '2026-11-09')).toEqual([
      { cycle: 'A', status: 'past', progress: 1 },
      { cycle: 'B', status: 'past', progress: 1 },
      { cycle: 'A', status: 'current', progress: 0.5 },
      { cycle: 'B', status: 'future', progress: 0 },
      { cycle: 'A', status: 'future', progress: 0 },
      { cycle: 'B', status: 'future', progress: 0 },
    ]);
  });

  it('follows the rolled-forward block and the block length', () => {
    const t = timeline(extendCycle(A2), '2026-11-09', 4);
    expect(t).toHaveLength(4);
    expect(t[2]).toEqual({ cycle: 'A', status: 'current', progress: 1 / 3 });
    expect(timeline(A2, '2026-11-16', 3).map((b) => b.cycle)).toEqual(['B', 'A', 'B']);
  });

  it('small block counts keep the current block', () => {
    expect(timeline(A2, '2026-11-02', 1)).toEqual([{ cycle: 'A', status: 'current', progress: 0 }]);
    expect(timeline(A2, '2026-11-02', 2).map((b) => b.status)).toEqual(['past', 'current']);
  });
});
