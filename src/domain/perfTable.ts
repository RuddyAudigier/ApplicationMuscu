import { isoToFr } from './dates';
import { e1rm, roundE1rm } from './e1rm';
import type { Performance, Variant } from './model';
import { round2 } from './numbers';
import { sameVariant } from './variants';

const MAX_REPS = 30;
const w0 = (p: Performance): number => p.weight ?? 0;

/** Appartenance d'une perf à une colonne de variante : même identité que la détection de PR. */
const inColumn = (p: Performance, v: Variant): boolean => sameVariant(p, v);

/** Meilleure perf par reps (index 0 = 1 rep … 29 = 30 reps) ; égalité → la plus récente. */
export function bestByReps(perfs: Performance[], variant: Variant): (Performance | null)[] {
  const cells: (Performance | null)[] = Array.from({ length: MAX_REPS }, () => null);
  for (const p of perfs) {
    if (!inColumn(p, variant)) continue;
    const reps = Math.trunc(p.reps);
    if (!Number.isFinite(reps) || reps < 1 || reps > MAX_REPS) continue;
    const existing = cells[reps - 1] ?? null;
    if (existing === null || w0(p) > w0(existing) || (w0(p) === w0(existing) && p.performanceDate > existing.performanceDate)) {
      cells[reps - 1] = p;
    }
  }
  return cells;
}

/** Vide les cellules dominées (≥ reps et ≥ poids, un strict). Pas d'epsilon. */
export function paretoMask(cells: (Performance | null)[]): (Performance | null)[] {
  return cells.map((p, i) => {
    if (!p) return null;
    const dominated = cells.some((o, j) => {
      if (!o) return false;
      return j >= i && w0(o) >= w0(p) && (j > i || w0(o) > w0(p));
    });
    return dominated ? null : p;
  });
}

/** Pied de bloc exercice : séances (dates distinctes) et meilleur e1RM arrondi au dixième. */
export function exerciseFooter(perfs: Performance[]): { sessions: number; bestE1rm: number | null } {
  let best = 0;
  for (const p of perfs) {
    const v = e1rm(p.weight, p.reps);
    if (v !== null && v > best) best = v;
  }
  return { sessions: new Set(perfs.map((p) => p.performanceDate)).size, bestE1rm: best > 0 ? roundE1rm(best) : null };
}

export function globalStats(perfs: Performance[]): { series: number; tonnage: number; reps: number; exercises: number } {
  return {
    series: perfs.length,
    tonnage: round2(perfs.reduce((sum, p) => sum + p.reps * w0(p), 0)),
    reps: perfs.reduce((sum, p) => sum + p.reps, 0),
    exercises: new Set(perfs.map((p) => p.exerciseName)).size,
  };
}

/** Export « Copier Excel » : 30 lignes `"{poids}\t{date FR}"`. */
export function excelExport(cells: (Performance | null)[]): string {
  const lines: string[] = [];
  for (let i = 0; i < MAX_REPS; i += 1) {
    const p = cells[i] ?? null;
    const weight = p?.weight != null ? String(round2(p.weight)).replace('.', ',') : '';
    lines.push(`${weight}\t${p ? isoToFr(p.performanceDate) : ''}`);
  }
  return lines.join('\n');
}
