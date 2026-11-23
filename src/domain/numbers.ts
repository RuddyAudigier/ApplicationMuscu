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

export function formatSignedWeight(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return '-';
  const r = round2(n);
  return `${r >= 0 ? '+' : '-'}${String(Math.abs(r)).replace('.', ',')}`;
}
