import { feelingCountsLabel, type BlockRange, type BlockReview } from '@/domain/blockReview';
import { isoToFr, isoToShortFr, todayIso } from '@/domain/dates';
import type { IsoDate } from '@/domain/model';
import { normalizeVariantName } from '@/domain/names';
import { formatWeight } from '@/domain/numbers';
import type { RecentPr } from '@/domain/records';
import { DEFAULT_VARIANT, variantLabel } from '@/domain/variants';
import type { PdfReportModel } from '@/platform/pdf';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2 nov. » */
export function dayMonth(iso: IsoDate): string {
  return `${String(Number(iso.slice(8, 10)))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''}`.trim();
}

/** « Cycle A · 2 nov. → 15 nov. » */
export const blockLabel = (b: BlockRange): string => `Cycle ${b.cycle} · ${dayMonth(b.start)} → ${dayMonth(b.end)}`;

export const prLabel = (pr: RecentPr): string => {
  const variant = normalizeVariantName(pr.variantName) === normalizeVariantName(DEFAULT_VARIANT)
    ? ''
    : ` · ${variantLabel(pr.variantName)}`;
  return `${pr.exerciseName}${variant}`;
};
export const prValue = (pr: RecentPr): string => `${String(pr.reps)} × ${formatWeight(pr.weight)} kg`;

export const reviewFileName = (b: BlockRange): string => `bilan-bloc-${b.cycle}-${b.start}.pdf`;

export function reviewPdfModel(
  block: BlockRange,
  r: BlockReview,
  note: string,
  generatedAt: Date = new Date(),
): PdfReportModel {
  const sections: PdfReportModel['sections'] = [];
  const add = (heading: string, caption: string, rows: string[][]): void => {
    if (rows.length > 0) sections.push({ heading, caption, rows });
  };
  add('Records', String(r.prs.length), r.prs.map((pr) => [prLabel(pr), `${prValue(pr)} · ${isoToShortFr(pr.date)}`]));
  add('Sans PR', String(r.exercisesWithoutPr.length), r.exercisesWithoutPr.map((n) => [n, '']));
  add('Forme du jour', '', [
    ...(r.forms.frais > 0 ? [['Frais', String(r.forms.frais)]] : []),
    ...(r.forms.fatigue > 0 ? [['Fatigué', String(r.forms.fatigue)]] : []),
  ]);
  add('États par exercice', '', r.feelings.map((f) => [f.exercise, feelingCountsLabel(f.counts)]));
  add('États généraux', '', r.moods.map((m) => [`${isoToShortFr(m.date)} · ${m.sessionName}`, m.mood]));
  if (note.trim() !== '') add('Ressenti du bloc', '', [[note.trim(), '']]);
  const skipped = r.sessionsSkipped;
  const missed = r.sessionsMissed;
  return {
    title: `Bilan du bloc · Cycle ${block.cycle}`,
    meta: [`Du ${isoToFr(block.start)} au ${isoToFr(block.end)}`],
    summary: `${String(r.sessionsDone)}/${String(r.sessionsPlanned)} séances · ${String(skipped)} sautée${skipped > 1 ? 's' : ''} · ${String(missed)} manquée${missed > 1 ? 's' : ''} · ${String(r.prs.length)} PR`,
    columns: ['Élément', 'Détail'],
    widths: [45, 55],
    sections,
    footer: `MyMuscle · généré le ${isoToFr(todayIso(generatedAt))}`,
  };
}
