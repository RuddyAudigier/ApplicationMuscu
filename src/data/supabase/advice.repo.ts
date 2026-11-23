import type { AdviceRepo } from '../ports';
import { type Db, fail, isSchemaGap, must, NO_ROWS, run } from './client';
import { mapAdviceRow } from './mappers';

const SINGLETON_ID = 1;

export function createAdviceRepo(db: Db): AdviceRepo {
  return {
    async get() {
      const ctx = 'Lecture des conseils';
      const { data, error } = await run(
        db.from('general_advice').select('training_notes, nutrition_notes, sleep_notes').eq('id', SINGLETON_ID).single(), ctx);
      if (error) {
        if (error.code === NO_ROWS || isSchemaGap(error)) return null;
        fail(error, ctx);
      }
      return mapAdviceRow(data);
    },
    async save(a) {
      await must(db.from('general_advice').upsert([{
        id: SINGLETON_ID,
        training_notes: a.training,
        nutrition_notes: a.nutrition,
        sleep_notes: a.sleep,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'id' }), 'Sauvegarde des conseils');
    },
  };
}
