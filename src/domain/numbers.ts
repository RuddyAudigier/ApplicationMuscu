/** Convertit une saisie en nombre fini, `null` sinon (virgule décimale acceptée). */
export function toNumber(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    const s = v.replace(',', '.').trim();
    if (s === '') return null;
    n = Number(s);
  } else {
    return null;
  }
  return Number.isFinite(n) ? n : null;
}

/** Arrondi au centième. */
export function round2(n: number): number {
  return Number(n.toFixed(2));
}

export function parseWeight(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null || n < 0) return null;
  return round2(n);
}

export function parseReps(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null || !Number.isInteger(n) || n < 0) return null;
  return n;
}

export function parseRpe(v: unknown): number | null {
  const n = toNumber(v);
  if (n === null || !Number.isInteger(n) || n < 6 || n > 10) return null;
  return n;
}

export function formatWeight(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return '-';
  return String(round2(n)).replace('.', ',');
}

/** Nombre décimal à la française (« 9,5 ») ; chaîne vide sans valeur. */
export function formatDecimal(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return '';
  return String(round2(n)).replace('.', ',');
}

export function formatSignedWeight(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return '-';
  const r = round2(n);
  return `${r >= 0 ? '+' : '-'}${String(Math.abs(r)).replace('.', ',')}`;
}

/** Pas des boutons − / + : kilos au demi-kilo, reps à l'unité. */
export const WEIGHT_STEP = 0.5;
export const REPS_STEP = 1;

/**
 * Nouvelle saisie de kilos après un appui sur − (`-1`) ou + (`1`), à la française (« 62,5 »).
 * Champ vide : + donne un pas, − ne change rien. Jamais sous 0. `null` = saisie illisible, rien à faire.
 */
export function stepWeight(raw: string, dir: 1 | -1): string | null {
  if (raw.trim() === '') return dir > 0 ? formatDecimal(WEIGHT_STEP) : null;
  const n = parseWeight(raw);
  if (n === null) return null;
  return formatDecimal(Math.max(0, round2(n + dir * WEIGHT_STEP)));
}

/** Idem pour les reps : entier, jamais sous 1. */
export function stepReps(raw: string, dir: 1 | -1): string | null {
  if (raw.trim() === '') return dir > 0 ? String(REPS_STEP) : null;
  const n = parseReps(raw);
  if (n === null) return null;
  return String(Math.max(1, n + dir * REPS_STEP));
}
