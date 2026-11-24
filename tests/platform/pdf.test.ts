import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Call { m: string; args: unknown[] }

const state = vi.hoisted(() => ({ calls: [] as Call[], ctor: [] as unknown[], pages: 1 }));

vi.mock('jspdf', () => {
  class FakePdf {
    constructor(opts: unknown) {
      state.ctor.push(opts);
    }
    private rec(m: string, args: unknown[]): this {
      state.calls.push({ m, args });
      return this;
    }
    setFillColor(...a: unknown[]) { return this.rec('setFillColor', a); }
    setTextColor(...a: unknown[]) { return this.rec('setTextColor', a); }
    setDrawColor(...a: unknown[]) { return this.rec('setDrawColor', a); }
    setFont(...a: unknown[]) { return this.rec('setFont', a); }
    setFontSize(...a: unknown[]) { return this.rec('setFontSize', a); }
    rect(...a: unknown[]) { return this.rec('rect', a); }
    line(...a: unknown[]) { return this.rec('line', a); }
    text(...a: unknown[]) { return this.rec('text', a); }
    setPage(...a: unknown[]) { return this.rec('setPage', a); }
    addPage() {
      state.pages += 1;
      return this.rec('addPage', []);
    }
    getNumberOfPages() { return state.pages; }
    setProperties(...a: unknown[]) { return this.rec('setProperties', a); }
    getTextWidth(t: string) { return t.length * 2; }
    splitTextToSize(t: string, w: number) {
      state.calls.push({ m: 'split', args: [t, w] });
      // ~2 mm par caractère.
      const per = Math.max(1, Math.floor(w / 2));
      const out: string[] = [];
      for (let i = 0; i < t.length; i += per) out.push(t.slice(i, i + per));
      return out.length ? out : [''];
    }
    output(kind: string) {
      state.calls.push({ m: 'output', args: [kind] });
      return new Blob(['%PDF'], { type: 'application/pdf' });
    }
  }
  return { jsPDF: FakePdf };
});

import { buildPdf, preloadPdf, type PdfReportModel } from '@/platform/pdf';

const model = (rows: number): PdfReportModel => ({
  title: 'Compte rendu · A1',
  meta: ['Cycle A', 'Séance du lundi 23/11/2026', 'Durée : 52 min'],
  summary: '1 PR · 2 séries · 1 exercice',
  columns: ['Série', 'Variante', 'Reps × Poids', 'RPE', 'PR'],
  widths: [12, 38, 24, 10, 26],
  sections: [
    {
      heading: 'Développé couché',
      caption: '2 séries',
      rows: Array.from({ length: rows }, (_, i) => [`S${String(i + 1)}`, 'Classique', '4 × 100 kg', '9', i === 0 ? 'PR charge' : '—']),
    },
  ],
  footer: 'MyMuscle',
});

const texts = (): unknown[] => state.calls.filter((c) => c.m === 'text').map((c) => c.args[0]);

describe('buildPdf', () => {
  beforeEach(() => {
    state.calls = [];
    state.ctor = [];
    state.pages = 1;
  });

  it('builds an A4 document with title, meta, summary and table', async () => {
    const blob = await buildPdf(model(2));
    expect(blob.type).toBe('application/pdf');
    expect(state.ctor[0]).toMatchObject({ format: 'a4', unit: 'mm' });
    expect(state.calls.find((c) => c.m === 'setProperties')?.args[0]).toMatchObject({ title: 'Compte rendu · A1' });
    const t = texts();
    expect(t).toContainEqual(['Compte rendu · A1']);
    expect(t).toContainEqual(['Cycle A']);
    expect(t).toContainEqual(['Durée : 52 min']);
    expect(t).toContainEqual(['1 PR · 2 séries · 1 exercice']);
    expect(t).toContainEqual(['Développé couché']);
    expect(t).toContainEqual(['2 séries']);
    expect(t).toContain('SÉRIE');
    expect(t).toContain('REPS × POIDS');
    expect(t).toContainEqual(['PR charge']);
    expect(t).toContainEqual(['4 × 100 kg']);
    expect(t).toContain('MyMuscle · 1/1');
    expect(state.calls.at(-1)).toEqual({ m: 'output', args: ['blob'] });
  });

  it('wraps long cells and paginates long tables with repeated headers', async () => {
    const m = model(60);
    const first = m.sections[0];
    if (first?.rows[0]) first.rows[0][1] = 'Variante au nom vraiment très très long';
    await buildPdf(m);
    expect(state.pages).toBeGreaterThan(1);
    expect(texts().filter((t) => t === 'SÉRIE').length).toBe(state.pages);
    expect(texts()).toContain(`MyMuscle · ${String(state.pages)}/${String(state.pages)}`);
    const wrapped = texts().find((t) => Array.isArray(t) && (t as string[]).length > 1);
    expect(wrapped).toBeDefined();
  });

  it('reprints the exercise name with « (suite) » before the header on a page break', async () => {
    await buildPdf(model(60));
    const t = texts();
    const suites = t.filter((x) => Array.isArray(x) && x.join('') === 'Développé couché (suite)');
    expect(suites).toHaveLength(state.pages - 1);
    // Ordre sur la nouvelle page : titre (suite), puis en-tête de colonnes.
    const afterBreak = state.calls.slice(state.calls.findIndex((c) => c.m === 'addPage'));
    const firstTexts = afterBreak.filter((c) => c.m === 'text').map((c) => c.args[0]);
    expect(firstTexts[0]).toEqual(['Développé couché (suite)']);
    expect(firstTexts[1]).toEqual(['2 séries']);
    expect(firstTexts[2]).toBe('SÉRIE');
  });

  it('wraps long title, meta, summary and heading; heading leaves room for the caption', async () => {
    const m = model(1);
    const long = 'x'.repeat(200);
    m.title = long;
    m.meta = [long];
    m.summary = long;
    const section = m.sections[0];
    if (section) {
      section.heading = long;
      section.caption = '3 séries · fatigué';
    }
    await buildPdf(m);
    const multi = texts().filter((x) => Array.isArray(x) && x.length > 1 && x.join('') === long);
    expect(multi).toHaveLength(4);
    // Titre bandeau : la hauteur du rectangle suit le nombre de lignes.
    const rect = state.calls.find((c) => c.m === 'rect');
    expect(rect?.args[3]).toBeGreaterThan(12);
    // Le titre de section est coupé à la largeur disponible moins la légende mesurée.
    const captionW = '3 séries · fatigué'.length * 2;
    const headingSplit = state.calls.filter((c) => c.m === 'split' && c.args[0] === long).map((c) => c.args[1] as number);
    expect(headingSplit).toContain(210 - 32 - captionW - 4);
    const captionCall = state.calls.find((c) => c.m === 'text' && Array.isArray(c.args[0]) && (c.args[0] as string[]).join('') === '3 séries · fatigué');
    expect(captionCall?.args[3]).toEqual({ align: 'right' });
  });

  it('moves a new section to the next page when space runs out', async () => {
    const m = model(34);
    m.sections.push({ heading: 'Tractions', caption: '1 série', rows: [['S1', 'Classique', '6 × 20 kg', '9', '—']] });
    await buildPdf(m);
    expect(state.calls.some((c) => c.m === 'addPage')).toBe(true);
    expect(texts()).toContainEqual(['Tractions']);
  });

  it('loads jspdf once', async () => {
    expect(preloadPdf()).toBe(preloadPdf());
    await expect(preloadPdf()).resolves.toHaveProperty('jsPDF');
  });
});
