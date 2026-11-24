import { describe, expect, it, vi } from 'vitest';
import type { Exercise, Variant } from '@/domain/model';
import { importPerformances, parseCsv } from '@/domain/csv';

const tng: Variant = { id: 'v-tng', exerciseId: 'squat', name: 'Touch and Go', isDefault: true };
const pause: Variant = { id: 'v-pause', exerciseId: 'squat', name: 'Pause', isDefault: false };
const ex: Exercise[] = [
  { id: 'squat', name: 'Squat', description: '', muscleGroups: [], variants: [tng, pause], isCustom: false, createdAt: '', coachNotes: '' },
  { id: 'curl', name: 'Curl', description: '', muscleGroups: [], variants: [], isCustom: true, createdAt: '', coachNotes: '' },
];
const d = '2026-03-10';

describe('parseCsv', () => {
  it('detects the delimiter and handles quotes', () => {
    expect(parseCsv('a;b\r\n"x;y";"say ""hi"""\n\n 1 ; 2 ')).toEqual([['a', 'b'], ['x;y', 'say "hi"'], ['1', '2']]);
    expect(parseCsv('a,b\n1,"2,5"')).toEqual([['a', 'b'], ['1', '2,5']]);
    expect(parseCsv('  ')).toEqual([]);
  });
});

describe('importPerformances', () => {
  it('imports a minimal row with defaults', () => {
    const r = importPerformances('exercice;reps;poids\nSquat;5;100', ex, d);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([{
      exerciseId: 'squat', exerciseName: 'Squat', sessionName: 'Import CSV', reps: 5, weight: 100, rpe: 10,
      variantId: 'v-tng', variantName: 'Touch and Go', serieNumber: 1, performanceDate: d,
    }]);
  });

  it('resolves aliases, ids, variants, dates and sessions', () => {
    const text = [
      'Exercise ID,Exercise Name,Répétitions,Charge,RPE,Variante,Set,Date,Séance',
      'curl,,12,"14,5",8,,2,01/03/2026,Bras',
      ',SQUAT,3,140,9,pause,1,2026-03-02,',
      ',Squat,3,140,9,Box,1,,',
    ].join('\n');
    const r = importPerformances(text, ex, d);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { exerciseId: 'curl', exerciseName: 'Curl', sessionName: 'Bras', reps: 12, weight: 14.5, rpe: 8,
        variantId: null, variantName: 'Touch and Go', serieNumber: 2, performanceDate: '2026-03-01' },
      { exerciseId: 'squat', exerciseName: 'Squat', sessionName: 'Import CSV', reps: 3, weight: 140, rpe: 9,
        variantId: 'v-pause', variantName: 'Pause', serieNumber: 1, performanceDate: '2026-03-02' },
      { exerciseId: 'squat', exerciseName: 'Squat', sessionName: 'Import CSV', reps: 3, weight: 140, rpe: 9,
        variantId: null, variantName: 'Box', serieNumber: 1, performanceDate: d },
    ]);
  });

  it('reports exact legacy messages and skips invalid lines', () => {
    const text = [
      'exercice;reps;poids;rpe;serie;date;exercise_id',
      'Inconnu;5;100;;;;',
      ';5;100;;;;x9',
      ';5;100;;;;',
      'Squat;abc;100;;;;',
      'Squat;-1;100;;;;',
      'Squat;5;;;;;',
      'Squat;5;-2;;;;',
      'Squat;5;100;;0;;',
      'Squat;5;100;11;;;',
      'Squat;5;100;;;31/02/2026;',
      'Squat;0;100;;;;',
      'Squat;5;100;6;;;',
    ].join('\n');
    const r = importPerformances(text, ex, d);
    expect(r.errors).toEqual([
      'Ligne 2: exercice introuvable (Inconnu).',
      'Ligne 3: exercice introuvable (x9).',
      'Ligne 4: exercice introuvable (vide).',
      'Ligne 5: reps invalide.',
      'Ligne 6: reps invalide.',
      'Ligne 7: poids invalide.',
      'Ligne 8: poids invalide.',
      'Ligne 9: numéro de série invalide.',
      'Ligne 10: RPE doit être entre 6 et 10.',
      'Ligne 11: date invalide (31/02/2026).',
      'Ligne 12: 0 rep, ignorée.',
    ]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ reps: 5, rpe: 6 });
  });

  it('matches variants by normalized name; « Classique » is the default variant; RPE truncated like parseInt', () => {
    const text = [
      'exercice;reps;poids;variante;rpe',
      'Squat;5;100;Classique;9,5',
      'Squat;5;100;touch  and   go;',
      'Squat;5;100;  PAUSE ;',
      'Squat;5;100;Box  Squat;',
    ].join('\n');
    const r = importPerformances(text, ex, d);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => [x.variantId, x.variantName, x.rpe])).toEqual([
      ['v-tng', 'Touch and Go', 9],
      ['v-tng', 'Touch and Go', 10],
      ['v-pause', 'Pause', 10],
      [null, 'Box  Squat', 10],
    ]);
    expect(importPerformances('exercice;reps;poids;rpe\nSquat;5;100;abc', ex, d).errors).toEqual(['Ligne 2: RPE doit être entre 6 et 10.']);
  });

  it('matches the v1 plan examples', () => {
    expect(importPerformances('exercice;reps;poids;rpe\nSquat;5;100;11', ex, d).errors).toEqual(['Ligne 2: RPE doit être entre 6 et 10.']);
  });

  it('rejects empty or header-only files', () => {
    expect(importPerformances(' \r\n ', ex, d)).toEqual({ rows: [], errors: ['Le fichier CSV est vide.'] });
    expect(importPerformances('exercice;reps;poids\n\n', ex, d)).toEqual({
      rows: [], errors: ["Le CSV doit contenir une ligne d'en-tête et au moins une ligne de données."],
    });
  });

  it('missing columns behave as empty cells', () => {
    expect(importPerformances('exercice;reps\nSquat;5', ex, d).errors).toEqual(['Ligne 2: poids invalide.']);
  });

  it('rejects rows dated after today', () => {
    const r = importPerformances('exercice;reps;poids;date\nSquat;5;100;2026-03-10\nSquat;5;100;11/03/2026', ex, d);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual(['Ligne 3: date dans le futur (11/03/2026).']);
  });

  it('defaults today to the current local day', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 2, 10, 12) });
    try {
      const r = importPerformances('exercice;reps;poids;date\nSquat;5;100;\nSquat;5;100;2026-03-11', ex);
      expect(r.rows[0]?.performanceDate).toBe('2026-03-10');
      expect(r.errors).toEqual(['Ligne 3: date dans le futur (2026-03-11).']);
    } finally {
      vi.useRealTimers();
    }
  });
});
