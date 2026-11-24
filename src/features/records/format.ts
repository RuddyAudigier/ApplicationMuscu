import type { IsoDate } from '@/domain/model';
import { classify } from '@/domain/records';
import type { Reference } from '@/domain/model';
import { isoToShortFr, todayIso } from '@/domain/dates';
import { formatWeight } from '@/domain/numbers';

/** Lundi de la semaine de `today` (semaine ISO, fuseau local). */
export function weekStartIso(today: IsoDate): IsoDate {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return todayIso(date);
}

/** Veille de `today`. */
export function yesterdayIso(today: IsoDate): IsoDate {
  const [y, m, d] = today.split('-').map(Number);
  return todayIso(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 1));
}

/** Lendemain de `day`. */
export function nextDayIso(day: IsoDate): IsoDate {
  const [y, m, d] = day.split('-').map(Number);
  return todayIso(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1));
}

/** « Dimanche 22 novembre 2026 ». */
export function longDateFr(iso: IsoDate): string {
  const [y, m, d] = iso.split('-').map(Number);
  const label = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Concatène les classes CSS définies. */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');

export const kg =(n: number): string => `${formatWeight(n)} kg`;

const plural = (n: number, word: string): string => `${String(n)} ${word}${Math.abs(n) > 1 ? 's' : ''}`;

export type PrTone = 'pr' | 'equal' | 'below' | 'new';

export interface PrMessage {
  tone: PrTone;
  badge: string;
  /** Texte avant la charge de référence. */
  lead: string;
  /** Charge de référence mise en gras (absente pour un premier record). */
  strong: string | null;
  /** Texte après la charge. */
  tail: string;
}

/**
 * Libellé de l'encadré PR (écran d'ajout). Le classement vient du domaine
 * (`classify`) : aucune règle de PR n'est réimplémentée ici.
 */
export function prMessage(perf: { reps: number; weight: number }, ref: Reference | null): PrMessage {
  const result = classify(perf, ref);
  if (ref === null) {
    return {
      tone: 'new',
      badge: 'Nouveau',
      lead: `Premier record à ${plural(perf.reps, 'rep')} pour cette variante.`,
      strong: null,
      tail: '',
    };
  }
  const at = `à ${plural(ref.reps, 'rep')} : `;
  const date = ` du ${isoToShortFr(ref.date)}`;
  const dw = result.improvementDelta ?? 0;
  const dr = result.improvementDeltaReps ?? 0;
  switch (result.improvementStatus) {
    case 'improved': {
      const parts: string[] = [];
      if (Math.abs(dw) > 0.001) parts.push(`+${kg(dw)}`);
      if (dr > 0) parts.push(`+${plural(dr, 'rep')}`);
      return {
        tone: 'pr',
        badge: 'PR',
        lead: `Bat ton record ${at}`,
        strong: kg(ref.weight),
        tail: `${date}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`,
      };
    }
    case 'equaled':
      return { tone: 'equal', badge: 'Égalé', lead: `Égale ton record ${at}`, strong: kg(ref.weight), tail: date };
    case 'below':
      return {
        tone: 'below',
        badge: 'Pas un PR',
        lead: `Ton record ${at}`,
        strong: kg(ref.weight),
        tail: `${date}${ref.comparisonType === 'same-reps' ? ` (${formatWeight(dw)} kg)` : ''}`,
      };
    default:
      return {
        tone: 'new',
        badge: 'Nouveau',
        lead: `Premier record à ${plural(perf.reps, 'rep')}. Meilleure charge à moins de reps ${at}`,
        strong: kg(ref.weight),
        tail: date,
      };
  }
}
