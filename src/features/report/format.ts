import { isoToFr, isoToShortFr, todayIso } from '@/domain/dates';
import { FEELINGS, type Form } from '@/domain/journal';
import { formatDecimal, formatWeight } from '@/domain/numbers';
import type { Report } from '@/domain/report';
import type { PdfReportModel } from '@/platform/pdf';

export type ReportSerie = Report['exercises'][number]['series'][number];
export type PrKind = NonNullable<ReportSerie['prKind']>;

/** Libellé court du type de PR (sous le badge). */
export const PR_KIND_LABEL: Record<PrKind, string> = {
  charge: 'charge',
  reps: 'reps',
  hybride: 'hybride',
};

/** Libellé accessible / PDF du type de PR. */
export const PR_KIND_LONG: Record<PrKind, string> = {
  charge: 'record de charge',
  reps: 'record de répétitions',
  hybride: 'record hybride',
};

export const FORM_LABEL: Record<Form, string> = { frais: 'Frais', fatigue: 'Fatigué' };

export const feelingLabel = (id: NonNullable<Report['exercises'][number]['feeling']>): string =>
  FEELINGS.find((f) => f.id === id)?.label ?? id;

const localDate = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const weekday = (iso: string): string => {
  const d = localDate(iso);
  return d ? d.toLocaleDateString('fr-FR', { weekday: 'long' }) : '';
};

/** « lundi 23/11 » */
export function shortDate(iso: string): string {
  const day = weekday(iso);
  return day ? `${day} ${isoToShortFr(iso)}` : isoToShortFr(iso);
}

/** « lundi 23/11/2026 » */
export function longDate(iso: string): string {
  const day = weekday(iso);
  return day ? `${day} ${isoToFr(iso)}` : isoToFr(iso);
}

/** « 52 min », « 1 h 05 » */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${String(m)} min`;
  return `${String(Math.floor(m / 60))} h ${String(m % 60).padStart(2, '0')}`;
}

/** « 4 × 100 kg » */
export function formatPerf(s: Pick<ReportSerie, 'reps' | 'weight'>): string {
  return `${String(s.reps)} × ${formatWeight(s.weight)} kg`;
}

const plural = (n: number, one: string, many: string): string => `${String(n)} ${n > 1 ? many : one}`;

export function summaryLine(r: Report): string {
  return [plural(r.prCount, 'PR', 'PR'), plural(r.seriesCount, 'série', 'séries'), plural(r.exerciseCount, 'exercice', 'exercices')].join(' · ');
}

const slug = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');

/** `compte-rendu-{seance}-{date}.pdf`, sans accents ni caractères spéciaux. */
export function reportFileName(r: Pick<Report, 'title' | 'date'>): string {
  const seance = slug(r.title) || 'seance';
  const date = slug(r.date) || 'date';
  return `compte-rendu-${seance}-${date}.pdf`;
}

export function reportPdfModel(r: Report, generatedAt: Date = new Date()): PdfReportModel {
  const meta = [
    r.cycle ? `Cycle ${r.cycle}` : 'Hors cycle',
    `Séance du ${longDate(r.date)}`,
    `Durée : ${formatDuration(r.durationMin)}`,
  ];
  if (r.form) meta.push(`Forme du jour : ${FORM_LABEL[r.form]}`);
  if (r.mood.trim() !== '') meta.push(`État général : ${r.mood.trim()}`);
  return {
    title: `Compte rendu · ${r.title}`,
    meta,
    summary: summaryLine(r),
    columns: ['Série', 'Variante', 'Reps × Poids', 'RPE', 'PR'],
    widths: [12, 38, 24, 10, 26],
    sections: r.exercises.map((ex) => ({
      heading: ex.feeling ? `${ex.name} · ${feelingLabel(ex.feeling)}` : ex.name,
      caption: ex.seriesLabel,
      rows: ex.series.map((s) => [
        `S${String(s.n)}`,
        s.variant,
        formatPerf(s),
        formatDecimal(s.rpe),
        s.isPr ? (s.prKind ? `PR ${PR_KIND_LABEL[s.prKind]}` : 'PR') : '—',
      ]),
    })),
    footer: `MyMuscle · généré le ${isoToFr(todayIso(generatedAt))}`,
  };
}
