import { toNumber } from './numbers';

/** e1RM d'Epley : `weight × (1 + reps / 30)` ; `null` si invalide ou ≤ 0. */
export function e1rm(weight: unknown, reps: unknown): number | null {
  const w = toNumber(weight);
  const r = toNumber(reps);
  if (w === null || r === null || w <= 0 || r <= 0) return null;
  return w * (1 + r / 30);
}

/** Arrondi au dixième, `null` si non fini. */
export function roundE1rm(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}
