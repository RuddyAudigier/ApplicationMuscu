import { todayIso } from '../../domain/dates';
import type { Performance } from '../../domain/model';
import type { PerformancesRepo } from '../ports';
import { type Db, fail, must, run } from './client';
import { mapPerformanceRow, parseRows, preparePerformances, type PerformanceRowWrite } from './mappers';

const PAGE_SIZE = 1000;

/** Erreurs justifiant le retry « legacy » sans `rpe` / `variant_*` (INV §3.4). */
function isLegacySchemaError(error: { code?: string; message: string }): boolean {
  const msg = error.message.toLowerCase();
  return error.code === 'PGRST204' || error.code === '42703' || msg.includes('rpe') || msg.includes('variant');
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
      const { error } = await run(db.from('performances').insert(rows), ctx);
      if (error) {
        if (!isLegacySchemaError(error)) fail(error, ctx);
        await must(db.from('performances').insert(rows.map(withoutRpeAndVariant)), ctx);
      }
      return { written: rows.length };
    },
  };
}
