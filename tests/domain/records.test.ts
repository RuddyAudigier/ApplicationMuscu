import { describe, expect, it } from 'vitest';
import type { Performance, Reference } from '@/domain/model';
import { PR_EPSILON, buildHistoryIndex, classify, findPreviousBest } from '@/domain/records';

let seq = 0;
const perf = (over: Partial<Performance>): Performance => ({
  id: `p${String(++seq)}`,
  exerciseId: 'bench',
  exerciseName: 'Développé couché',
  sessionName: 'Séance test (mock)',
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

/** createdAt ISO à une heure locale donnée du jour `date`. */
const localAt = (date: string, h: number, m = 0): string => {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1, h, m).toISOString();
};

// Seed mock INV §4 (bench, Touch and Go), createdAt = heure du seed (autre jour → minuit local).
const SEED_AT = '2026-04-01T08:00:00.000Z';
const s5x90 = perf({ reps: 5, weight: 90, performanceDate: '2026-03-01', createdAt: SEED_AT });
const s6x90 = perf({ reps: 6, weight: 90, performanceDate: '2026-03-05', createdAt: SEED_AT });
const s6x92 = perf({ reps: 6, weight: 92.5, serieNumber: 2, performanceDate: '2026-03-10', createdAt: SEED_AT });
const seed = [s5x90, s6x90, s6x92];

describe('PR_EPSILON', () => {
  it('is 0.01', () => {
    expect(PR_EPSILON).toBe(0.01);
  });
});

describe('findPreviousBest — seed mock', () => {
  const index = buildHistoryIndex(seed);

  it('6x90 (03-05) → lower-reps 5x90', () => {
    const ref = findPreviousBest(index, 'bench', s6x90);
    expect(ref).toMatchObject({ reps: 5, weight: 90, date: '2026-03-01', comparisonType: 'lower-reps' });
    expect(classify({ reps: 6, weight: 90 }, ref)).toMatchObject({
      improvementStatus: 'improved', isRepsPr: true, isHybridPr: false,
    });
  });

  it('6x92.5 (03-10) → same-reps 6x90 (5x90 obsolète)', () => {
    const ref = findPreviousBest(index, 'bench', s6x92);
    expect(ref).toMatchObject({ reps: 6, weight: 90, date: '2026-03-05', comparisonType: 'same-reps' });
  });

  it('first perf has no reference', () => {
    expect(findPreviousBest(index, 'bench', s5x90)).toBeNull();
  });
});

describe('findPreviousBest — steps', () => {
  it('step 0: returns null on invalid input', () => {
    const index = buildHistoryIndex(seed);
    const later = { performanceDate: '2026-04-10', createdAt: null };
    expect(findPreviousBest(index, null, perf({ ...later, exerciseId: null, exerciseName: '  ' }))).toBeNull();
    expect(findPreviousBest(index, 'bench', perf({ ...later, reps: 0 }))).toBeNull();
    expect(findPreviousBest(index, 'bench', perf({ ...later, weight: null }))).toBeNull();
    expect(findPreviousBest(index, 'bench', perf({ performanceDate: 'nope' }))).toBeNull();
  });

  it('step 1: strict timestamp — same createdAt batch does not compare', () => {
    const at = localAt('2026-03-20', 18);
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-20', createdAt: at });
    const b = perf({ reps: 5, weight: 105, performanceDate: '2026-03-20', createdAt: at });
    const index = buildHistoryIndex([a, b]);
    expect(findPreviousBest(index, 'bench', b)).toBeNull();
  });

  it('step 1: earlier session the same day (older createdAt) counts', () => {
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-20', createdAt: localAt('2026-03-20', 9) });
    const b = perf({ reps: 5, weight: 105, performanceDate: '2026-03-20', createdAt: localAt('2026-03-20', 18) });
    const ref = findPreviousBest(buildHistoryIndex([a, b]), 'bench', b);
    expect(ref).toMatchObject({ reps: 5, weight: 100, comparisonType: 'same-reps' });
  });

  it('step 1: atTimestamp overrides the perf timestamp', () => {
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-20', createdAt: localAt('2026-03-20', 18) });
    const index = buildHistoryIndex([a]);
    const live = perf({ reps: 5, weight: 110, performanceDate: '2026-03-20', createdAt: null });
    expect(findPreviousBest(index, 'bench', live)).toBeNull();
    const now = new Date(2026, 2, 20, 19).getTime();
    expect(findPreviousBest(index, 'bench', live, { atTimestamp: now })).toMatchObject({ weight: 100 });
    expect(findPreviousBest(index, 'bench', live, { atTimestamp: Number.NaN })).toBeNull();
  });

  it('step 2: dominated references are excluded from the frontier', () => {
    const old = perf({ reps: 5, weight: 100, performanceDate: '2026-03-01' });
    const dom = perf({ reps: 6, weight: 100, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 5, weight: 99, performanceDate: '2026-03-03' });
    const ref = findPreviousBest(buildHistoryIndex([old, dom, cur]), 'bench', cur);
    // Série dominée : la référence à mêmes reps plus lourde reste la comparaison (« en dessous »).
    expect(ref).toMatchObject({ reps: 5, weight: 100, comparisonType: 'same-reps' });
    expect(classify({ reps: 5, weight: 99 }, ref).improvementStatus).toBe('below');
  });

  it('step 2: epsilon in obsolescence (weight − 0.01 still dominates)', () => {
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-01' });
    const b = perf({ reps: 6, weight: 99.995, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 5, weight: 100, performanceDate: '2026-03-03' });
    expect(findPreviousBest(buildHistoryIndex([a, b, cur]), 'bench', cur)?.comparisonType).toBe('higher-reps');
  });

  it('step 3: same reps → heaviest; near-equal tie → most recent', () => {
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-01' });
    const b = perf({ reps: 5, weight: 100.005, performanceDate: '2026-03-02' });
    const c = perf({ reps: 5, weight: 100, performanceDate: '2026-03-03' });
    const cur = perf({ reps: 5, weight: 90, performanceDate: '2026-03-04' });
    const ref = findPreviousBest(buildHistoryIndex([a, b, c, cur]), 'bench', cur);
    expect(ref).toMatchObject({ weight: 100, date: '2026-03-03', comparisonType: 'same-reps' });
  });

  it('step 3: within epsilon of the max, the most recent wins whatever the input order', () => {
    // Écart assumé au legacy : son `reduce` dépendait de l'ordre d'entrée dans ce cas.
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-02' });
    const b = perf({ reps: 5, weight: 100.005, performanceDate: '2026-03-01' });
    const cur = perf({ reps: 5, weight: 90, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([a, b, cur]), 'bench', cur)).toMatchObject({ weight: 100 });
    expect(findPreviousBest(buildHistoryIndex([b, a, cur]), 'bench', cur)).toMatchObject({ weight: 100 });
  });

  it('step 4: nearest lower reps, heaviest there', () => {
    const a = perf({ reps: 3, weight: 120, performanceDate: '2026-03-01' });
    const b = perf({ reps: 4, weight: 110, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 6, weight: 100, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([a, b, cur]), 'bench', cur)).toMatchObject({
      reps: 4, weight: 110, comparisonType: 'lower-reps',
    });
  });

  it('step 5: dominating reference: nearest reps, then lightest, then most recent', () => {
    const a = perf({ reps: 8, weight: 100, performanceDate: '2026-03-01' });
    const b = perf({ reps: 7, weight: 110, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 6, weight: 95, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([a, b, cur]), 'bench', cur)).toMatchObject({
      reps: 7, weight: 110, comparisonType: 'higher-reps',
    });
  });

  it('step 6: nothing comparable → null', () => {
    const a = perf({ reps: 8, weight: 80, performanceDate: '2026-03-01' });
    const cur = perf({ reps: 6, weight: 95, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([a, cur]), 'bench', cur)).toBeNull();
  });
});

describe('findPreviousBest — règle PR utilisateur (prime sur la parité legacy)', () => {
  const statusOf = (history: Performance[], cur: Performance) =>
    classify({ reps: cur.reps, weight: cur.weight ?? 0 }, findPreviousBest(buildHistoryIndex([...history, cur]), 'bench', cur));

  it('plus de reps à charge égale : 3x100 puis 4x100 → PR reps', () => {
    const a = perf({ reps: 3, weight: 100, performanceDate: '2026-03-01' });
    const cur = perf({ reps: 4, weight: 100, performanceDate: '2026-03-04' });
    expect(statusOf([a], cur)).toMatchObject({ improvementStatus: 'improved', isRepsPr: true });
  });

  it('C4 : la référence à mêmes reps n’est pas écartée par la frontière (12x100 + 10x100, 10x105)', () => {
    const a = perf({ reps: 12, weight: 100, performanceDate: '2026-03-01' });
    const b = perf({ reps: 10, weight: 100, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 10, weight: 105, performanceDate: '2026-03-04' });
    const ref = findPreviousBest(buildHistoryIndex([a, b, cur]), 'bench', cur);
    expect(ref).toMatchObject({ reps: 10, weight: 100, comparisonType: 'same-reps' });
    expect(statusOf([a, b], cur)).toMatchObject({ improvementStatus: 'improved', improvementDelta: 5 });
  });

  it('Q2 : une série antérieure qui domine → « en dessous » (10x100 + 5x110, 8x100)', () => {
    const a = perf({ reps: 10, weight: 100, performanceDate: '2026-03-01' });
    const b = perf({ reps: 5, weight: 110, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 8, weight: 100, performanceDate: '2026-03-04' });
    const ref = findPreviousBest(buildHistoryIndex([a, b, cur]), 'bench', cur);
    expect(ref).toMatchObject({ reps: 10, weight: 100, comparisonType: 'higher-reps' });
    expect(statusOf([a, b], cur).improvementStatus).toBe('below');
  });

  it('Q2 : dominée même avec une référence à mêmes reps plus légère', () => {
    const a = perf({ reps: 10, weight: 90, performanceDate: '2026-03-01' });
    const b = perf({ reps: 12, weight: 100, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 10, weight: 95, performanceDate: '2026-03-04' });
    expect(statusOf([a, b], cur).improvementStatus).toBe('below');
  });

  it('égalité à ε près : pas dominée, « égalé »', () => {
    const a = perf({ reps: 5, weight: 100, performanceDate: '2026-03-01' });
    const cur = perf({ reps: 5, weight: 99.995, performanceDate: '2026-03-04' });
    expect(statusOf([a], cur).improvementStatus).toBe('equaled');
  });

  it('variantes séparées : une autre variante ne domine pas', () => {
    const a = perf({ reps: 10, weight: 120, variantName: 'Pause', performanceDate: '2026-03-01' });
    const b = perf({ reps: 3, weight: 100, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 4, weight: 100, performanceDate: '2026-03-04' });
    expect(statusOf([a, b], cur)).toMatchObject({ improvementStatus: 'improved', isRepsPr: true });
  });
});

describe('buildHistoryIndex identity keys', () => {
  it('matches homonym exercises and same-name variants, separates others', () => {
    const other = perf({ exerciseId: 'b2', exerciseName: 'developpe  COUCHE', variantName: ' touch AND go', reps: 5, weight: 100 });
    const pause = perf({ variantName: 'Pause', reps: 5, weight: 150, performanceDate: '2026-03-02' });
    const squat = perf({ exerciseId: 'squat', exerciseName: 'Squat', reps: 5, weight: 200, performanceDate: '2026-03-02' });
    const cur = perf({ reps: 5, weight: 90, performanceDate: '2026-03-04' });
    const ref = findPreviousBest(buildHistoryIndex([other, pause, squat, cur]), 'bench', cur);
    expect(ref).toMatchObject({ weight: 100, comparisonType: 'same-reps' });
  });

  it('matches by variant id even when names differ', () => {
    const a = perf({ variantId: 'v1', variantName: 'Ancien nom', reps: 5, weight: 100 });
    const cur = perf({ variantId: 'v1', variantName: 'Nouveau nom', reps: 5, weight: 90, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([a, cur]), 'bench', cur)).toMatchObject({ weight: 100 });
  });

  it('rename then recreate the same name: the new variant has no previous best', () => {
    // v1 « Pause » renommée (ses perfs gardent v1), puis nouvelle variante v3 « Pause ».
    const old = perf({ variantId: 'v1', variantName: 'Pause', reps: 5, weight: 100 });
    const cur = perf({ variantId: 'v3', variantName: 'Pause', reps: 5, weight: 90, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([old, cur]), 'bench', cur)).toBeNull();
  });

  it('legacy rows without id match by normalised name, also for a query with an id', () => {
    const legacy = perf({ variantId: null, variantName: 'pause', reps: 5, weight: 100 });
    const cur = perf({ variantId: 'v1', variantName: 'Pause', reps: 5, weight: 90, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([legacy, cur]), 'bench', cur)).toMatchObject({ weight: 100 });
    const curNoId = perf({ variantId: null, variantName: 'PAUSE ', reps: 5, weight: 90, performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex([legacy, curNoId]), 'bench', curNoId)).toMatchObject({ weight: 100 });
  });

  it('excludes invalid rows', () => {
    const rows = [
      perf({ exerciseId: null, exerciseName: '' }),
      perf({ performanceDate: '' }),
      perf({ reps: 0 }),
      perf({ weight: -1 }),
      perf({ weight: null }),
    ];
    const cur = perf({ performanceDate: '2026-03-04' });
    expect(findPreviousBest(buildHistoryIndex(rows), 'bench', cur)).toBeNull();
  });
});

describe('classify (INV §3.10.5)', () => {
  const ref = (reps: number, weight: number, comparisonType: Reference['comparisonType']): Reference => ({
    reps, weight, comparisonType, date: '2026-03-01', timestamp: 0,
  });

  it('no reference → data-capture', () => {
    expect(classify({ reps: 5, weight: 90 }, null)).toEqual({
      improvementStatus: 'data-capture', improvementDelta: null, improvementDeltaReps: null,
      isHybridPr: false, isRepsPr: false,
    });
  });

  it('same-reps rows', () => {
    expect(classify({ reps: 5, weight: 92.5 }, ref(5, 90, 'same-reps'))).toEqual({
      improvementStatus: 'improved', improvementDelta: 2.5, improvementDeltaReps: 0,
      isHybridPr: false, isRepsPr: false,
    });
    expect(classify({ reps: 5, weight: 90.005 }, ref(5, 90, 'same-reps')).improvementStatus).toBe('equaled');
    expect(classify({ reps: 5, weight: 89.995 }, ref(5, 90, 'same-reps')).improvementStatus).toBe('equaled');
    expect(classify({ reps: 5, weight: 87.5 }, ref(5, 90, 'same-reps'))).toMatchObject({
      improvementStatus: 'below', improvementDelta: -2.5,
    });
  });

  it('lower-reps rows', () => {
    expect(classify({ reps: 6, weight: 92.5 }, ref(5, 90, 'lower-reps'))).toEqual({
      improvementStatus: 'improved', improvementDelta: 2.5, improvementDeltaReps: 1,
      isHybridPr: true, isRepsPr: false,
    });
    expect(classify({ reps: 6, weight: 90 }, ref(5, 90, 'lower-reps'))).toMatchObject({
      improvementStatus: 'improved', isHybridPr: false, isRepsPr: true,
    });
    expect(classify({ reps: 6, weight: 85 }, ref(5, 90, 'lower-reps'))).toMatchObject({
      improvementStatus: 'data-capture', isHybridPr: false, isRepsPr: false, improvementDelta: -5,
    });
  });

  it('higher-reps → below', () => {
    expect(classify({ reps: 5, weight: 95 }, ref(8, 100, 'higher-reps'))).toEqual({
      improvementStatus: 'below', improvementDelta: -5, improvementDeltaReps: -3,
      isHybridPr: false, isRepsPr: false,
    });
  });

  it('rounds deltas to hundredths', () => {
    expect(classify({ reps: 5, weight: 100.333 }, ref(5, 100, 'same-reps')).improvementDelta).toBe(0.33);
  });
});
