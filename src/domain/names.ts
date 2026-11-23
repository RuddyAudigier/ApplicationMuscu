const asText = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function normalizeExerciseName(v: unknown): string | null {
  const s = stripAccents(asText(v).trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return s === '' ? null : s;
}

export function normalizeVariantName(v: unknown): string {
  return (asText(v) || 'Touch and Go').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeSearch(v: string): string {
  return stripAccents(v.trim().toLowerCase());
}

export function normalizeHeader(v: string): string {
  return stripAccents(v.trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
