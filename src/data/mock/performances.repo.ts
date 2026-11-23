import { todayIso } from '../../domain/dates';
import type { Performance } from '../../domain/model';
import type { PerformancesRepo } from '../ports';
import { mapPerformanceRow, parseRows, preparePerformances } from '../shared/rules';
import { task, type MockContext } from './db';

/** Même tri que Supabase : `performance_date desc`, puis `created_at desc`. */
const byDateDesc = (a: Performance, b: Performance): number =>
  b.performanceDate.localeCompare(a.performanceDate) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

export function createMockPerformancesRepo(ctx: MockContext): PerformancesRepo {
  return {
    list: () => task(() => parseRows(ctx.read().performances, mapPerformanceRow, 'performances').sort(byDateDesc)),

    /** Mêmes validations que Supabase ; aucune suppression (D1). */
    add: (inputs) => task(() => {
      const rows = preparePerformances(inputs, todayIso(ctx.now()));
      if (rows.length === 0) return { written: 0 };
      ctx.write((db) => {
        const createdAt = ctx.now().toISOString();
        db.performances.unshift(...rows.map((r) => ({ ...r, id: ctx.genId('perf'), created_at: createdAt })));
      });
      return { written: rows.length };
    }),
  };
}
