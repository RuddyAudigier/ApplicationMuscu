import type { IsoDate, Performance } from './model';

const pad = (n: number): string => String(n).padStart(2, '0');
const fmt = (y: number, m: number, d: number): IsoDate => `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;

function buildIso(y: number, m: number, d: number): IsoDate | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null;
  return fmt(y, m, d);
}

export function parseDateToIso(v: unknown): IsoDate | null {
  if (typeof v !== 'string') return null;
  const raw = v.trim();
  if (raw === '') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(raw);
  if (iso) return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+.*)?$/.exec(raw);
  if (fr) return buildIso(Number(fr[3]), Number(fr[2]), Number(fr[1]));
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return fmt(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Jour local de `now` (injectable). */
export function todayIso(now: Date = new Date()): IsoDate {
  return fmt(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoToFr(iso: IsoDate): string {
  if (!ISO_RE.test(iso)) return iso;
  const [y = '', m = '', d = ''] = iso.split('-');
  return d + '/' + m + '/' + y;
}

export function isoToShortFr(iso: IsoDate): string {
  if (!ISO_RE.test(iso)) return iso;
  const [, m = '', d = ''] = iso.split('-');
  return d + '/' + m;
}

export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Horodatage : createdAt si même jour local que performanceDate, sinon minuit local. */
export function performanceTimestamp(
  p: Pick<Performance, 'performanceDate' | 'createdAt'>,
): number | null {
  const day = parseDateToIso(p.performanceDate);
  if (day === null) return null;
  if (p.createdAt) {
    const ts = Date.parse(p.createdAt);
    if (Number.isFinite(ts) && ts > 0 && todayIso(new Date(ts)) === day) return ts;
  }
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
}
