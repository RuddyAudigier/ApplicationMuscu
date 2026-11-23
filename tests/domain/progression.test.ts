import { describe, expect, it } from 'vitest';
import type { Performance } from '@/domain/model';
import { pickVariant, progressionFor, variantOptions } from '@/domain/progression';

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

describe('variantOptions', () => {
  it('derives options from perfs: trimmed lowercase key, first label, fr sort', () => {
    const perfs = [
      perf({ variantName: ' Pause ' }),
      perf({ variantName: 'touch and go' }),
      perf({ variantName: 'TOUCH AND GO' }),
      perf({ variantName: '' }),
      perf({ variantName: 'Élastique' }),
      perf({ exerciseId: 'squat', variantName: 'Box' }),
    ];
    expect(variantOptions(perfs, 'bench')).toEqual([
      { key: 'élastique', label: 'Élastique' },
      { key: 'pause', label: 'Pause' },
      { key: 'touch and go', label: 'touch and go' },
    ]);
  });

  it('defaults blank variant name to Touch and Go', () => {
    expect(variantOptions([perf({ variantName: '   ' })], 'bench')).toEqual([
      { key: 'touch and go', label: 'Touch and Go' },
    ]);
  });
});

describe('pickVariant', () => {
  const opts = [{ key: 'pause', label: 'Pause' }, { key: 'touch and go', label: 'Touch and Go' }];
  it('keeps the selection when present', () => {
    expect(pickVariant(opts, 'pause')).toBe('pause');
  });
  it('falls back to touch and go, then first, then null', () => {
    expect(pickVariant(opts, 'gone')).toBe('touch and go');
    expect(pickVariant(opts)).toBe('touch and go');
    expect(pickVariant([{ key: 'pause', label: 'Pause' }])).toBe('pause');
    expect(pickVariant([])).toBeNull();
  });
});

describe('progressionFor', () => {
  const perfs = [
    perf({ reps: 5, weight: 100, performanceDate: '2026-03-05', createdAt: '2026-03-05T10:00:00.000Z' }),
    perf({ reps: 5, weight: 90, performanceDate: '2026-03-01' }),
    perf({ reps: 8, weight: 80, performanceDate: '2026-03-01' }),
    perf({ reps: 5, weight: 95, performanceDate: '2026-03-10' }),
    perf({ reps: 5, weight: 0, performanceDate: '2026-03-10' }),
    perf({ reps: 5, weight: 98, performanceDate: '2026-03-05', createdAt: '2026-03-05T09:00:00.000Z' }),
    perf({ reps: 0, weight: 200, performanceDate: '2026-03-10' }),
    perf({ reps: 5, weight: null, performanceDate: '2026-03-10' }),
    perf({ reps: 5, weight: 300, performanceDate: '' }),
    perf({ reps: 5, weight: 300, variantName: 'Pause' }),
    perf({ reps: 5, weight: 300, exerciseId: 'squat' }),
  ];

  it('builds daily points', () => {
    const { points } = progressionFor(perfs, 'bench', 'touch and go');
    expect(points.map((p) => p.date)).toEqual(['2026-03-01', '2026-03-05', '2026-03-10']);
    expect(points[0]).toEqual({
      date: '2026-03-01', maxWeight: 90, bestE1rm: 90 * (1 + 5 / 30), volume: 450 + 640, totalReps: 13, series: 2,
    });
    expect(points[2]).toMatchObject({ maxWeight: 95, series: 2, volume: 475, totalReps: 10 });
  });

  it('computes stats (deltaE1rm = max − first, legacy quirk)', () => {
    const { stats, points } = progressionFor(perfs, 'bench', 'touch and go');
    const maxE1rm = 100 * (1 + 5 / 30);
    expect(stats).toEqual({
      maxWeight: 100,
      maxE1rm,
      totalVolume: points.reduce((s, p) => s + p.volume, 0),
      sessions: 3,
      deltaE1rm: maxE1rm - (points[0]?.bestE1rm ?? 0),
    });
  });

  it('deltaE1rm null with fewer than 2 dates; empty input', () => {
    expect(progressionFor([perf({})], 'bench', 'touch and go').stats.deltaE1rm).toBeNull();
    const empty = progressionFor([], 'bench', 'touch and go');
    expect(empty.points).toEqual([]);
    expect(empty.stats).toEqual({ maxWeight: 0, maxE1rm: 0, totalVolume: 0, sessions: 0, deltaE1rm: null });
    expect(empty.grid).toEqual({ dates: [], rows: [] });
  });

  it('builds the reps × dates grid with pr/down/normal/empty', () => {
    const { grid } = progressionFor(perfs, 'bench', 'touch and go');
    expect(grid.dates).toEqual(['2026-03-01', '2026-03-05', '2026-03-10']);
    expect(grid.rows.map((r) => r.reps)).toEqual([5, 8]);
    expect(grid.rows[0]).toEqual({
      reps: 5,
      cells: [
        { status: 'pr', weight: 90 },
        { status: 'pr', weight: 100 },
        { status: 'down', weight: 95 },
      ],
      pr: 100,
    });
    expect(grid.rows[1]).toEqual({
      reps: 8,
      cells: [{ status: 'pr', weight: 80 }, { status: 'empty', weight: null }, { status: 'empty', weight: null }],
      pr: 80,
    });
  });

  it('grid: zero weight is normal (not PR), equal weight is normal', () => {
    const { grid } = progressionFor(
      [perf({ weight: 0, performanceDate: '2026-03-01' }), perf({ weight: 0, performanceDate: '2026-03-02' })],
      'bench', 'touch and go',
    );
    expect(grid.rows[0]?.cells.map((c) => c.status)).toEqual(['normal', 'normal']);
    expect(grid.rows[0]?.pr).toBe(0);
  });
});
