import { e1rm } from './e1rm';
import type { Id, IsoDate, Performance } from './model';
import { toNumber } from './numbers';
import { DEFAULT_VARIANT } from './variants';

export interface DayPoint { date: IsoDate; maxWeight: number; bestE1rm: number; volume: number; totalReps: number; series: number }
export interface ProgressStats { maxWeight: number; maxE1rm: number; totalVolume: number; sessions: number; deltaE1rm: number | null }
type CellStatus = 'pr' | 'down' | 'normal' | 'empty';
export interface RepGrid {
  dates: IsoDate[];
  rows: { reps: number; cells: { status: CellStatus; weight: number | null }[]; pr: number }[];
}
interface VariantOption { key: string; label: string }

const variantLabel = (p: Pick<Performance, 'variantName'>): string =>
  (p.variantName || DEFAULT_VARIANT).trim() || DEFAULT_VARIANT;

const DEFAULT_KEY = DEFAULT_VARIANT.toLowerCase();

/** Options de variante dérivées des perfs de l'exercice (INV §3.6). */
export function variantOptions(perfs: Performance[], exerciseId: Id): VariantOption[] {
  const map = new Map<string, string>();
  for (const p of perfs) {
    if (p.exerciseId !== exerciseId) continue;
    const label = variantLabel(p);
    const key = label.toLowerCase();
    if (!map.has(key)) map.set(key, label);
  }
  return Array.from(map, ([key, label]) => ({ key, label })).sort((a, b) =>
    a.label.localeCompare(b.label, 'fr-FR'),
  );
}

/** Variante effective : sélection si présente, sinon « touch and go », sinon la première. */
export function pickVariant(options: VariantOption[], selected?: string): string | null {
  if (selected !== undefined && options.some((o) => o.key === selected)) return selected;
  return (options.find((o) => o.key === DEFAULT_KEY) ?? options[0])?.key ?? null;
}

interface Row { date: IsoDate; reps: number; weight: number; created: number }

function rowsFor(perfs: Performance[], exerciseId: Id, variantKey: string): Row[] {
  const rows: Row[] = [];
  for (const p of perfs) {
    if (p.exerciseId !== exerciseId || variantLabel(p).toLowerCase() !== variantKey) continue;
    const reps = toNumber(p.reps) ?? 0;
    const weight = toNumber(p.weight);
    const date = p.performanceDate.slice(0, 10);
    if (!date || reps <= 0 || weight === null) continue;
    const created = p.createdAt ? Date.parse(p.createdAt) : 0;
    rows.push({ date, reps, weight, created: Number.isFinite(created) ? created : 0 });
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.created - b.created));
}

function buildPoints(rows: Row[]): DayPoint[] {
  const byDate = new Map<IsoDate, DayPoint>();
  for (const r of rows) {
    let point = byDate.get(r.date);
    if (!point) {
      point = { date: r.date, maxWeight: 0, bestE1rm: 0, volume: 0, totalReps: 0, series: 0 };
      byDate.set(r.date, point);
    }
    point.series += 1;
    point.totalReps += r.reps;
    point.volume += r.weight * r.reps;
    point.maxWeight = Math.max(point.maxWeight, r.weight);
    point.bestE1rm = Math.max(point.bestE1rm, e1rm(r.weight, r.reps) ?? 0);
  }
  return Array.from(byDate.values());
}

function buildStats(points: DayPoint[]): ProgressStats {
  const first = points[0];
  if (!first) return { maxWeight: 0, maxE1rm: 0, totalVolume: 0, sessions: 0, deltaE1rm: null };
  const maxE1rm = Math.max(...points.map((p) => p.bestE1rm));
  return {
    maxWeight: Math.max(...points.map((p) => p.maxWeight)),
    maxE1rm,
    totalVolume: points.reduce((sum, p) => sum + p.volume, 0),
    sessions: points.length,
    // Quirk legacy conservé : max global − premier jour (pas dernier − premier).
    deltaE1rm: points.length >= 2 ? maxE1rm - first.bestE1rm : null,
  };
}

function buildGrid(rows: Row[]): RepGrid {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const cellMap = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.date}|${String(r.reps)}`;
    const existing = cellMap.get(key);
    if (existing === undefined || r.weight > existing) cellMap.set(key, r.weight);
  }
  const usedReps = [...new Set(rows.map((r) => r.reps))].sort((a, b) => a - b);
  return {
    dates,
    rows: usedReps.map((reps) => {
      let allTimeMax = 0;
      let previous: number | null = null;
      const cells = dates.map((date) => {
        const weight = cellMap.get(`${date}|${String(reps)}`);
        if (weight === undefined) return { status: 'empty' as const, weight: null };
        let status: CellStatus = 'normal';
        if (weight > allTimeMax) {
          status = 'pr';
          allTimeMax = weight;
        } else if (previous !== null && weight < previous) {
          status = 'down';
        }
        previous = weight;
        return { status, weight };
      });
      return { reps, cells, pr: allTimeMax };
    }),
  };
}

/** Progression d'un exercice pour une variante : points par jour, stats, grille reps × dates. */
export function progressionFor(
  perfs: Performance[],
  exerciseId: Id,
  variantKey: string,
): { points: DayPoint[]; stats: ProgressStats; grid: RepGrid } {
  const rows = rowsFor(perfs, exerciseId, variantKey);
  const points = buildPoints(rows);
  return { points, stats: buildStats(points), grid: buildGrid(rows) };
}
