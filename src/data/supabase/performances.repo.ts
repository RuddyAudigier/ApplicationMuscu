import { todayIso } from '../../domain/dates';
import type { Performance } from '../../domain/model';
import type { PerformancesRepo } from '../ports';
import { type Db, fail, must, type PgResult, run } from './client';
import { mapPerformanceRow, parseRows, preparePerformances, type PerformanceRowWrite } from '../shared/rules';

const PAGE_SIZE = 1000;

/**
 * Retry « legacy » sans `rpe` / `variant_*` (INV §3.4) : uniquement sur colonne absente
 * (`PGRST204`, `42703`), ou erreur 400 sans code citant ces colonnes. Jamais sur 23503/23514.
 */
function isLegacySchemaError(res: PgResult): boolean {
  const { error, status } = res;
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = error.message.toLowerCase();
  return !error.code && status === 400 && (msg.includes('rpe') || msg.includes('variant'));
}

const withoutRpeAndVariant = (r: PerformanceRowWrite) => ({
  exercise_id: r.exercise_id, exercise_name: r.exercise_name, session_name: r.session_name, reps: r.reps,
  weight: r.weight, series_number: r.series_number, performance_date: r.performance_date,
});

export function createPerformancesRepo(db: Db, now: () => Date = () => new Date()): PerformancesRepo {
  return {
    /** Lecture paginée jusqu'à épuisement (D4 : PostgREST plafonne à 1000 lignes). */
    async list() {
      const out: Performance[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const page = await must(
          db.from('performances').select('*')
            .order('performance_date', { ascending: false })
            .order('created_at', { ascending: false })
            // Départage unique : les lots partagent date et `created_at` (pages stables).
            .order('id', { ascending: false })
            .range(from, from + PAGE_SIZE - 1),
          'Lecture des performances',
        );
        const rows = Array.isArray(page) ? (page as unknown[]) : [];
        out.push(...parseRows(rows, mapPerformanceRow, 'performances'));
        if (rows.length < PAGE_SIZE) return out;
      }
    },

    /** Aucune suppression de performance (D1 : pas de nettoyage « obsolètes »). */
    async add(inputs) {
      const ctx = 'Enregistrement des performances';
      const rows = preparePerformances(inputs, todayIso(now()));
      if (rows.length === 0) return { written: 0 };
      const insertOnce = { idempotent: false };
      const res = await run(db.from('performances').insert(rows), ctx, insertOnce);
      if (res.error) {
        if (!isLegacySchemaError(res)) fail(res.error, ctx);
        await must(db.from('performances').insert(rows.map(withoutRpeAndVariant)), ctx, insertOnce);
      }
      return { written: rows.length };
    },
  };
}
