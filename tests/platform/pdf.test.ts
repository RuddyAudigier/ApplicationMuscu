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
    splitTextToSize(t: string, w: number) {
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

import { buildPdf, type PdfReportModel } from '@/platform/pdf';

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
    const t = texts();
    expect(t).toContain('Compte rendu · A1');
    expect(t).toContain('Cycle A');
    expect(t).toContain('Durée : 52 min');
    expect(t).toContain('1 PR · 2 séries · 1 exercice');
    expect(t).toContain('Développé couché');
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

  it('moves a new section to the next page when space runs out', async () => {
    const m = model(34);
    m.sections.push({ heading: 'Tractions', caption: '1 série', rows: [['S1', 'Classique', '6 × 20 kg', '9', '—']] });
    await buildPdf(m);
    expect(state.calls.some((c) => c.m === 'addPage')).toBe(true);
    expect(texts()).toContain('Tractions');
  });
});
