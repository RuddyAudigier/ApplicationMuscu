import { describe, expect, it } from 'vitest';
import { sampleReport } from './fixtures';
import {
  formatDuration,
  formatPerf,
  longDate,
  reportFileName,
  reportPdfModel,
  shortDate,
  summaryLine,
} from '@/features/report/format';

describe('report format', () => {
  it('formats dates, durations and perfs in French', () => {
    expect(shortDate('2026-11-23')).toBe('lundi 23/11');
    expect(longDate('2026-11-23')).toBe('lundi 23/11/2026');
    expect(shortDate('bad')).toBe('bad');
    expect(longDate('bad')).toBe('bad');
    expect(formatDuration(52)).toBe('52 min');
    expect(formatDuration(65)).toBe('1 h 05');
    expect(formatDuration(-3)).toBe('0 min');
    expect(formatPerf({ reps: 5, weight: 82.5 })).toBe('5 × 82,5 kg');
  });

  it('summarises with French plurals', () => {
    expect(summaryLine(sampleReport)).toBe('2 PR · 3 séries · 2 exercices');
    expect(summaryLine({ ...sampleReport, prCount: 0, seriesCount: 1, exerciseCount: 1 })).toBe('0 PR · 1 série · 1 exercice');
  });

  it('sanitizes the file name', () => {
    expect(reportFileName(sampleReport)).toBe('compte-rendu-haut-du-corps-2026-11-23.pdf');
    expect(reportFileName({ title: 'Épaules / Bras ! (A2)', date: '2026-11-23' })).toBe(
      'compte-rendu-epaules-bras-a2-2026-11-23.pdf',
    );
    expect(reportFileName({ title: '***', date: '../..' })).toBe('compte-rendu-seance-date.pdf');
    expect(reportFileName({ title: 'x'.repeat(100), date: '2026-11-23' })).toMatch(/^compte-rendu-x{48}-2026-11-23\.pdf$/);
  });

  it('builds the PDF model with cycle, summary and PR kinds', () => {
    const m = reportPdfModel(sampleReport, new Date(2026, 10, 24));
    expect(m.title).toBe('Compte rendu · Haut du corps');
    expect(m.meta).toEqual(['Cycle A', 'Séance du lundi 23/11/2026', 'Durée : 52 min']);
    expect(m.summary).toBe('2 PR · 3 séries · 2 exercices');
    expect(m.columns).toEqual(['Série', 'Variante', 'Reps × Poids', 'RPE', 'PR']);
    expect(m.sections[0]?.rows).toEqual([
      ['S1', 'Classique', '4 × 100 kg', '9', 'PR reps'],
      ['S2', 'Pausé 2 ct', '5 × 82,5 kg', '9', '—'],
    ]);
    expect(m.sections[1]).toMatchObject({ heading: 'Curl', caption: '1 série · fatigué' });
    expect(m.sections[1]?.rows[0]?.[4]).toBe('PR hybride');
    expect(m.footer).toBe('MyMuscle · généré le 24/11/2026');
    const noCycle = reportPdfModel({
      ...sampleReport,
      cycle: null,
      exercises: [{ name: 'X', seriesLabel: '1 série', series: [{ n: 1, variant: 'Classique', reps: 1, weight: 1, rpe: 8, isPr: true, prKind: null }] }],
    });
    expect(noCycle.meta[0]).toBe('Hors cycle');
    expect(noCycle.sections[0]?.rows[0]?.[4]).toBe('PR');
  });
});
