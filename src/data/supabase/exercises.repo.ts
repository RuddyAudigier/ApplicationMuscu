import type { Exercise, Id, Variant } from '../../domain/model';
import type { CoachNotesRepo, ExercisesRepo } from '../ports';
import { type Db, fail, isSchemaGap, must, run } from './client';
import { parseRows, prepareExercise, type PreparedExercise } from '../shared/rules';
import { mapExerciseRow, mapVariantRow } from './mappers';

const VARIANT_COLS = 'id, exercise_id, name, is_default';

const idOf = (row: unknown): string | null => {
  const id = (row as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : null;
};

export function createExercisesRepo(db: Db, coachNotes: CoachNotesRepo): ExercisesRepo {
  /** Variantes groupées par exercice ; table absente tolérée (INV §2.1). */
  async function variantsFor(ids: Id[]): Promise<Map<Id, Variant[]>> {
    const byId = new Map<Id, Variant[]>();
    if (ids.length === 0) return byId;
    const ctx = 'Lecture des variantes';
    const { data, error } = await run(
      db.from('exercise_variants').select(VARIANT_COLS).in('exercise_id', ids).order('created_at', { ascending: true }), ctx);
    if (error) {
      if (isSchemaGap(error, 'exercise_variants')) return byId;
      fail(error, ctx);
    }
    for (const v of parseRows(data, mapVariantRow, 'exercise_variants')) {
      const key = v.exerciseId ?? '';
      byId.set(key, [...(byId.get(key) ?? []), v]);
    }
    return byId;
  }

  async function readOne(id: Id): Promise<Exercise> {
    const ctx = "Lecture de l'exercice";
    const row = await must(db.from('exercises_with_muscles').select('*').eq('id', id).single(), ctx);
    const [variants, notes] = await Promise.all([variantsFor([id]), coachNotes.listAll()]);
    const ex = mapExerciseRow(row, variants.get(id) ?? [], notes[id] ?? '');
    if (!ex) throw new Error(`${ctx} : réponse invalide.`);
    return ex;
  }

  async function writeMuscles(id: Id, p: PreparedExercise, ctx: string): Promise<void> {
    if (p.muscleGroups.length === 0) return;
    await must(db.from('muscle_groups').insert(p.muscleGroups.map((m) => ({ exercise_id: id, muscle_group: m }))), ctx);
  }

  /** Synchro des variantes (supprime les absentes, met à jour, insère). Non transactionnel, comme l'existant. */
  async function syncVariants(id: Id, variants: Variant[]): Promise<void> {
    const ctx = 'Synchronisation des variantes';
    const { data, error } = await run(db.from('exercise_variants').select('id').eq('exercise_id', id), ctx);
    if (error) {
      if (isSchemaGap(error, 'exercise_variants')) {
        console.warn('Sync variantes ignorée (migration SQL manquante).');
        return;
      }
      fail(error, ctx);
    }
    const existing = parseRows(data, idOf, 'exercise_variants');
    const kept = new Set(variants.map((v) => v.id).filter((v): v is string => v !== null));
    const toDelete = existing.filter((e) => !kept.has(e));
    if (toDelete.length > 0) await must(db.from('exercise_variants').delete().in('id', toDelete), ctx);
    for (const v of variants) {
      if (v.id) {
        await must(db.from('exercise_variants').update({ name: v.name, is_default: v.isDefault }).eq('id', v.id), ctx);
      } else {
        await must(db.from('exercise_variants').insert([{ exercise_id: id, name: v.name, is_default: v.isDefault }]), ctx);
      }
    }
  }

  return {
    /** Vue + 1 requête variantes + 1 requête remarques (pas de N+1). */
    async list() {
      const data = await must(
        db.from('exercises_with_muscles').select('*').order('created_at', { ascending: false }), 'Lecture des exercices');
      const rows = Array.isArray(data) ? (data as unknown[]) : [];
      const ids = rows.map(idOf).filter((id): id is string => id !== null);
      const [variants, notes] = await Promise.all([variantsFor(ids), coachNotes.listAll()]);
      return parseRows(rows, (r) => {
        const key = idOf(r) ?? '';
        return mapExerciseRow(r, variants.get(key) ?? [], notes[key] ?? '');
      }, 'exercises');
    },

    async create(draft) {
      const ctx = "Création de l'exercice";
      const p = prepareExercise(draft, null);
      const row = await must(
        db.from('exercises').insert([{ name: p.name, description: p.description, is_custom: true }]).select('id').single(), ctx);
      const id = idOf(row);
      if (id === null) throw new Error(`${ctx} : id manquant.`);
      await writeMuscles(id, p, ctx);
      const { error } = await run(
        db.from('exercise_variants').insert(p.variants.map((v) => ({ exercise_id: id, name: v.name, is_default: v.isDefault }))), ctx);
      if (error && !isSchemaGap(error, 'exercise_variants')) fail(error, ctx);
      return readOne(id);
    },

    async update(id, draft) {
      const ctx = "Mise à jour de l'exercice";
      const p = prepareExercise(draft, id);
      const base = { name: p.name, description: p.description };
      const { error } = await run(db.from('exercises').update({ ...base, updated_at: new Date().toISOString() }).eq('id', id), ctx);
      if (error) {
        // Anciennes bases sans colonne `updated_at`.
        if (!isSchemaGap(error, 'updated_at')) fail(error, ctx);
        await must(db.from('exercises').update(base).eq('id', id), ctx);
      }
      await must(db.from('muscle_groups').delete().eq('exercise_id', id), ctx);
      await writeMuscles(id, p, ctx);
      await syncVariants(id, p.variants);
      return readOne(id);
    },

    async remove(id) {
      await must(db.from('exercises').delete().eq('id', id), "Suppression de l'exercice");
    },
  };
}
