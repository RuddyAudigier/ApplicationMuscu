/**
 * Génération d'un PDF A4 tabulaire (compte rendu de séance) avec jsPDF.
 * jsPDF est chargé à la demande (import dynamique) pour rester hors du bundle initial.
 */

export interface PdfTableSection {
  /** Titre de la section (nom de l'exercice). */
  heading: string;
  /** Légende à droite du titre (« 3 séries · fatigué »). */
  caption: string;
  /** Lignes du tableau, une cellule par colonne. */
  rows: string[][];
}

export interface PdfReportModel {
  title: string;
  /** Lignes d'information sous le titre (cycle, date, durée). */
  meta: string[];
  /** Résumé (« 4 PR · 12 séries · 5 exercices »). */
  summary: string;
  columns: string[];
  /** Largeur relative de chaque colonne (somme quelconque). */
  widths: number[];
  sections: PdfTableSection[];
  footer: string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ROW_H = 7;
const LINE_H = 4.5;

/** Couleurs : impression sur fond blanc, accent citron foncé pour rester lisible. */
const INK: [number, number, number] = [10, 10, 10];
const MUTED: [number, number, number] = [110, 106, 100];
const RULE: [number, number, number] = [220, 218, 214];
const ACCENT: [number, number, number] = [212, 245, 60];

export async function buildPdf(model: PdfReportModel): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const total = model.widths.reduce((a, b) => a + b, 0) || 1;
  const xs: number[] = [];
  let acc = MARGIN;
  for (const w of model.widths) {
    xs.push(acc);
    acc += (w / total) * CONTENT_W;
  }

  let y = MARGIN;
  const ensure = (needed: number): void => {
    if (y + needed <= PAGE_H - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  };

  // Bandeau titre.
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y, 4, 12, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(model.title, MARGIN + 7, y + 9);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  for (const line of model.meta) {
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(model.summary, MARGIN, y);
  y += 10;

  const header = (): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    model.columns.forEach((c, i) => {
      doc.text(c.toUpperCase(), (xs[i] ?? MARGIN) + 1, y);
    });
    y += 2;
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  };

  for (const section of model.sections) {
    ensure(14 + ROW_H * Math.min(section.rows.length, 2));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(section.heading, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(section.caption, PAGE_W - MARGIN, y, { align: 'right' });
    y += 6;
    header();
    for (const row of section.rows) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      // Cellules longues (variantes) : retour à la ligne dans leur colonne.
      const cells = row.map((cell, i) => {
        const width = (((model.widths[i] ?? 0) / total) * CONTENT_W) - 2;
        return doc.splitTextToSize(cell, Math.max(width, 4)) as string[];
      });
      const height = ROW_H + (Math.max(1, ...cells.map((c) => c.length)) - 1) * LINE_H;
      if (y + height > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
        header();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }
      doc.setTextColor(...INK);
      cells.forEach((lines, i) => {
        doc.text(lines, (xs[i] ?? MARGIN) + 1, y);
      });
      y += height;
    }
    y += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.text(`${model.footer} · ${String(p)}/${String(pages)}`, MARGIN, PAGE_H - 8);
  }

  return doc.output('blob');
}
