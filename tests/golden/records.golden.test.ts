/**
 * Test golden : `findPreviousBest` (src/domain/records.ts) ≡ legacy (`legacyRecords.js`, copie
 * verbatim de legacy/src/App.jsx) sur 300 historiques aléatoires (seed fixe).
 *
 * Les entrées évitent volontairement les deux divergences assumées de la réécriture :
 * - `toNumber` : reps/poids sont toujours des nombres (ou `null` pour le poids), jamais des
 *   chaînes blanches, booléens ou objets ;
 * - horodatage : le legacy compare `createdAt.slice(0, 10)` (jour UTC), la réécriture le jour
 *   LOCAL (D3). `createdAt` est généré à une heure locale de journée (10h–13h) ; si son jour UTC
 *   diffère de son jour local (fuseau extrême du process), il est remplacé par `null`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Performance } from '@/domain/model';
import { buildHistoryIndex, findPreviousBest } from '@/domain/records';
import * as legacy from './legacyRecords';

const EXERCISES: { id: string | null; name: string }[] = [
  { id: 'bench', name: 'Développé couché' },
  { id: 'bench-2', name: '  developpe COUCHE!' }, // homonyme normalisé
  { id: 'squat', name: 'Squat' },
  { id: null, name: 'Développé-couché' },
  { id: 'bench', name: 'Bench press' }, // même id, nom renommé
];
const VARIANTS: { id: string | null; name: string }[] = [
  { id: 'v-tng', name: 'Touch and Go' },
  { id: null, name: '  touch AND  go' }, // même variante, autre casse
  { id: 'v-pause', name: 'Pause' },
  { id: null, name: '' }, // → Touch and Go par défaut
  { id: 'v-pause', name: 'Pause longue' }, // même id, nom renommé
];

const pad = (n: number): string => String(n).padStart(2, '0');
const localDay = (d: Date): string => `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** createdAt à `hour` locale du jour `dayOffset`, ou null si jour UTC ≠ jour local. */
function createdAtFor(dayOffset: number, hour: number): string | null {
  const at = new Date(2026, 0, 1 + dayOffset, hour, 0, 0);
  const iso = at.toISOString();
  return iso.slice(0, 10) === localDay(at) ? iso : null;
}

const perfArb = fc.record({
  ex: fc.integer({ min: 0, max: EXERCISES.length - 1 }),
  variant: fc.integer({ min: 0, max: VARIANTS.length - 1 }),
  reps: fc.integer({ min: 1, max: 12 }),
  weightStep: fc.option(fc.integer({ min: 0, max: 80 }), { nil: null, freq: 12 }),
  day: fc.integer({ min: 0, max: 59 }),
  created: fc.constantFrom('none', 'same-day', 'same-day', 'other-day'),
  slot: fc.integer({ min: 0, max: 3 }),
  shift: fc.integer({ min: 1, max: 3 }),
});

type Gen = typeof perfArb extends fc.Arbitrary<infer T> ? T : never;

function toPerformance(g: Gen, i: number): Performance {
  const ex = EXERCISES[g.ex] ?? EXERCISES[0];
  const variant = VARIANTS[g.variant] ?? VARIANTS[0];
  const performanceDate = localDay(new Date(2026, 0, 1 + g.day));
  const createdAt =
    g.created === 'none' ? null
      : createdAtFor(g.created === 'same-day' ? g.day : g.day + g.shift, 10 + g.slot);
  return {
    id: `g${String(i)}`,
    exerciseId: ex?.id ?? null,
    exerciseName: ex?.name ?? '',
    sessionName: 'Golden',
    reps: g.reps,
    weight: g.weightStep === null ? null : g.weightStep * 2.5,
    rpe: null,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? '',
    serieNumber: 1,
    performanceDate,
    createdAt,
  };
}

const view = (r: { reps: number; weight: number; date: string; comparisonType: string } | null) =>
  r === null ? null : { reps: r.reps, weight: r.weight, date: r.date, comparisonType: r.comparisonType };

describe('findPreviousBest golden vs legacy', () => {
  it('matches legacy on 300 random histories', () => {
    let compared = 0;
    let nonNull = 0;
    fc.assert(
      fc.property(fc.array(perfArb, { minLength: 1, maxLength: 30 }), (gens) => {
        const history = gens.map(toPerformance);
        const index = buildHistoryIndex(history);
        const legacyIndex = legacy.buildHistoryIndex(history);
        for (const p of history) {
          const actual = view(findPreviousBest(index, p.exerciseId, p));
          const expected = view(legacy.findPreviousBest(legacyIndex, p.exerciseId, p));
          expect(actual).toEqual(expected);
          compared += 1;
          if (expected !== null) nonNull += 1;
        }
      }),
      { numRuns: 300, seed: 20261123 },
    );
    // Garde-fou : le générateur produit bien des références non triviales.
    expect(compared).toBeGreaterThan(1000);
    expect(nonNull).toBeGreaterThan(compared / 4);
  });
});
