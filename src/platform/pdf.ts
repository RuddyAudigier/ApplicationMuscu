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
  /** Ligne atténuée sous le tableau (séries de chauffe), `null` si aucune. */
  note?: string | null;
}

export interface PdfReportModel {
  title: string;
  /** Lignes d'information sous le titre (cycle, date, durée). */
  meta: string[];
  /** Résumé (« 4 PR · 12 séries · 5 exercices »). */
  summary: string;
  /** Échauffement général fait (liste atténuée avant les exercices), `null` si aucun. */
  warmup?: { heading: string; lines: string[] } | null;
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

/** Interligne jsPDF par défaut (facteur 1,15) converti de points en mm. */
const lineStep = (pt: number): number => pt * 1.15 * (25.4 / 72);

type JsPdfModule = typeof import('jspdf');
let jsPdfModule: Promise<JsPdfModule> | null = null;

/**
 * Lance le chargement de jsPDF (une seule fois) : à appeler au montage de l'écran pour que
 * le partage Web Share reste dans la fenêtre d'activation utilisateur au clic.
 */
export function preloadPdf(): Promise<JsPdfModule> {
  jsPdfModule ??= import('jspdf').catch((error: unknown) => {
    jsPdfModule = null;
    throw error;
  });
  return jsPdfModule;
}

export async function buildPdf(model: PdfReportModel): Promise<Blob> {
  const { jsPDF } = await preloadPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({ title: model.title, creator: 'MyMuscle' });

  const split = (text: string, width: number): string[] => doc.splitTextToSize(text, width) as string[];

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

  // Bandeau titre (retour à la ligne si le nom de séance est long).
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  const titleLines = split(model.title, CONTENT_W - 7);
  const titleExtra = (titleLines.length - 1) * lineStep(20);
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y, 4, 12 + titleExtra, 'F');
  doc.text(titleLines, MARGIN + 7, y + 9);
  y += 18 + titleExtra;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  for (const line of model.meta) {
    const lines = split(line, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += 5 + (lines.length - 1) * lineStep(10);
  }
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  const summaryLines = split(model.summary, CONTENT_W);
  doc.text(summaryLines, MARGIN, y);
  y += 10 + (summaryLines.length - 1) * lineStep(12);

  /** Titre de section : la légende est mesurée d'abord pour réserver sa place à droite. */
  const sectionTitle = (heading: string, caption: string): void => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const captionW = caption ? doc.getTextWidth(caption) : 0;
    const headingW = Math.max(CONTENT_W - captionW - 4, CONTENT_W / 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    const lines = split(heading, headingW);
    doc.text(lines, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const captionLines = split(caption, CONTENT_W - headingW - 4);
    doc.text(captionLines, PAGE_W - MARGIN, y, { align: 'right' });
    const rows = Math.max(lines.length, 1);
    y += 6 + (rows - 1) * lineStep(12) + Math.max(0, captionLines.length - rows) * lineStep(9);
  };

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

  if (model.warmup) {
    ensure(14 + ROW_H);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(model.warmup.heading, MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    for (const line of model.warmup.lines) {
      const lines = split(`• ${line}`, CONTENT_W - 2);
      ensure(LINE_H * lines.length + 2);
      doc.text(lines, MARGIN + 1, y);
      y += LINE_H * lines.length + 1;
    }
    y += 4;
  }

  for (const section of model.sections) {
    ensure(14 + ROW_H * Math.min(section.rows.length, 2));
    sectionTitle(section.heading, section.caption);
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
        sectionTitle(`${section.heading} (suite)`, section.caption);
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
    if (section.note) {
      // Chauffe : italique atténué, clairement distinct des séries de travail.
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      const lines = split(section.note, CONTENT_W - 2);
      ensure(LINE_H * lines.length + 2);
      doc.text(lines, MARGIN + 1, y + 1);
      y += LINE_H * lines.length + 2;
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
