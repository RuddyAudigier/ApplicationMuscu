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
 *
 * Écarts VOLONTAIRES (règle PR de l'utilisateur, prioritaire sur la parité legacy) :
 * - Q2 : si une série antérieure domine la série (reps ≥, charge ≥, un axe strictement > à ε près),
 *   le résultat est « en dessous » quel que soit l'ordre des étapes. Le legacy pouvait renvoyer une
 *   référence à reps inférieures (→ « prise de données »), ex. 10x100 + 5x110 puis 8x100.
 * - C4 : la référence à mêmes reps est cherchée dans tout l'historique, pas seulement sur la frontière
 *   de Pareto. Le legacy l'écartait si elle était dominée (ex. 12x100 + 10x100, puis 10x105 : le
 *   legacy ne trouvait aucune référence, la réécriture compare à 10x100 → PR charge).
 * - Départage à ε près indépendant de l'ordre d'entrée (le `reduce` legacy en dépendait) : non
 *   exercé ici (charges multiples de 2,5).
 * Dans ces cas, le test vérifie la règle (statut attendu) au lieu de l'égalité avec le legacy.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Performance } from '@/domain/model';
import { buildHistoryIndex, classify, findPreviousBest, PR_EPSILON } from '@/domain/records';
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

interface Point { reps: number; weight: number }
const dominates = (o: Point, c: Point): boolean =>
  o.reps >= c.reps && o.weight >= c.weight - PR_EPSILON && (o.reps > c.reps || o.weight > c.weight + PR_EPSILON);

const view = (r: { reps: number; weight: number; date: string; comparisonType: string } | null) =>
  r === null ? null : { reps: r.reps, weight: r.weight, date: r.date, comparisonType: r.comparisonType };

describe('findPreviousBest golden vs legacy', () => {
  it('matches legacy on 300 random histories', () => {
    let compared = 0;
    let nonNull = 0;
    const divergences = { q2: 0, c4: 0 };
    fc.assert(
      fc.property(fc.array(perfArb, { minLength: 1, maxLength: 30 }), (gens) => {
        const history = gens.map(toPerformance);
        const index = buildHistoryIndex(history);
        const legacyIndex = legacy.buildHistoryIndex(history);
        for (const p of history) {
          const ref = findPreviousBest(index, p.exerciseId, p);
          const actual = view(ref);
          const expected = view(legacy.findPreviousBest(legacyIndex, p.exerciseId, p));
          compared += 1;
          if (expected !== null) nonNull += 1;
          const now = legacy.getPerformanceTimestamp(p);
          if (p.weight === null || now === null) {
            expect(actual).toEqual(expected);
            continue;
          }
          const cur = { reps: p.reps, weight: p.weight };
          const previous = legacy.findAllCandidates(legacyIndex, p.exerciseId, p).filter((c) => c.timestamp < now);
          const frontier = previous.filter((c) => !legacy.isObsoleteReference(c, previous));
          if (previous.some((c) => dominates(c, cur))) {
            // Q2 : dominée → « en dessous ».
            expect(classify(cur, ref).improvementStatus).toBe('below');
            if (actual?.comparisonType !== expected?.comparisonType || actual?.reps !== expected?.reps) divergences.q2 += 1;
          } else if (previous.some((c) => c.reps === p.reps) && !frontier.some((c) => c.reps === p.reps)) {
            // C4 : référence à mêmes reps hors frontière : la plus lourde de tout l'historique.
            const heaviest = Math.max(...previous.filter((c) => c.reps === p.reps).map((c) => c.weight));
            expect(actual).toMatchObject({ reps: p.reps, weight: heaviest, comparisonType: 'same-reps' });
            divergences.c4 += 1;
          } else {
            expect(actual).toEqual(expected);
          }
        }
      }),
      { numRuns: 300, seed: 20261123 },
    );
    // Garde-fou : le générateur produit bien des références non triviales.
    expect(compared).toBeGreaterThan(1000);
    expect(nonNull).toBeGreaterThan(compared / 4);
    // Les deux écarts sont bien exercés et restent minoritaires.
    expect(divergences.q2).toBeGreaterThan(0);
    expect(divergences.c4).toBeGreaterThan(0);
    expect(divergences.q2 + divergences.c4).toBeLessThan(compared / 4);
  });
});
