import type { Exercise, Id, Variant } from '../../domain/model';
import type { CoachNotesRepo, ExercisesRepo } from '../ports';
import { type Db, fail, isSchemaGap, must, run } from './client';
import { parseRows, prepareExercise, type PreparedExercise } from '../shared/rules';
import { mapExerciseRow, mapVariantRow } from './mappers';
import { normalizeVariantName } from '../../domain/names';

const VARIANT_COLS = 'id, exercise_id, name, is_default';

const idOf = (row: unknown): string | null => {
  const id = (row as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : null;
};

const idAndName = (row: unknown): { id: string; name: string } | null => {
  const r = row as { id?: unknown; name?: unknown } | null;
  return typeof r?.id === 'string' ? { id: r.id, name: typeof r.name === 'string' ? r.name : '' } : null;
};

const PAGE_SIZE = 1000;
/** Insert non idempotent : une réponse 502/504 perdue n'est pas rejouée (doublons), comme les perfs. */
const INSERT_ONCE = { idempotent: false } as const;
/** Taille des lots `in('id', …)` (longueur d'URL PostgREST). */
const ID_CHUNK = 200;

/** Ajoute l'id d'une perf sans `variant_id` dont le nom normalisé vaut `oldKey`. */
function legacyIdIfMatches(row: unknown, oldKey: string, out: string[]): void {
  const r = row as { id?: unknown; variant_id?: unknown; variant_name?: unknown } | null;
  if (r === null || r.variant_id) return;
  if (normalizeVariantName(r.variant_name) !== oldKey) return;
  if (typeof r.id === 'string' || typeof r.id === 'number') out.push(String(r.id));
}

/** Muscles identiques (même ordre) : pas de suppression / réinsertion. */
function sameMuscles(row: unknown, next: string[]): boolean {
  const current = (row as { muscle_groups?: unknown } | null)?.muscle_groups;
  return Array.isArray(current) && current.length === next.length && current.every((m, i) => m === next[i]);
}

export function createExercisesRepo(db: Db, coachNotes: CoachNotesRepo): ExercisesRepo {
  /** Variantes groupées par exercice ; table absente tolérée (INV §2.1). */
  async function variantsFor(ids: Id[]): Promise<Map<Id, Variant[]>> {
    const byId = new Map<Id, Variant[]>();
    if (ids.length === 0) return byId;
    const ctx = 'Lecture des variantes';
    const { data, error, status } = await run(
      db.from('exercise_variants').select(VARIANT_COLS).in('exercise_id', ids).order('created_at', { ascending: true }), ctx);
    if (error) {
      if (isSchemaGap(error, 'exercise_variants')) return byId;
      fail(error, ctx, status);
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
    await must(db.from('muscle_groups').insert(p.muscleGroups.map((m) => ({ exercise_id: id, muscle_group: m }))), ctx, INSERT_ONCE);
  }

  /**
   * Avant de renommer une variante : (1) rattache par id les perfs legacy (`variant_id` null) qui
   * portent l'ancien nom, (2) réécrit `variant_name` des perfs de cette variante. Mises à jour
   * idempotentes, aucune ligne supprimée (D1). Colonnes `variant_*` absentes : rien à faire.
   */
  async function relabelPerformances(exerciseId: Id, variantId: Id, oldName: string, newName: string): Promise<void> {
    const ctx = 'Renommage de la variante dans les performances';
    const oldKey = normalizeVariantName(oldName);
    const legacyIds: string[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error, status } = await run(
        db.from('performances').select('id, variant_id, variant_name').eq('exercise_id', exerciseId)
          .order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1), ctx);
      if (error) {
        if (isSchemaGap(error, 'variant')) return;
        fail(error, ctx, status);
      }
      const rows = Array.isArray(data) ? (data as unknown[]) : [];
      for (const r of rows) legacyIdIfMatches(r, oldKey, legacyIds);
      if (rows.length < PAGE_SIZE) break;
    }
    for (let i = 0; i < legacyIds.length; i += ID_CHUNK) {
      await must(db.from('performances').update({ variant_id: variantId }).in('id', legacyIds.slice(i, i + ID_CHUNK)), ctx);
    }
    await must(
      db.from('performances').update({ variant_name: newName }).eq('exercise_id', exerciseId).eq('variant_id', variantId), ctx);
  }

  /** Synchro des variantes (supprime les absentes, met à jour, insère). Non transactionnel, comme l'existant. */
  async function syncVariants(id: Id, variants: Variant[]): Promise<void> {
    const ctx = 'Synchronisation des variantes';
    const { data, error, status } = await run(db.from('exercise_variants').select('id, name').eq('exercise_id', id), ctx);
    if (error) {
      if (isSchemaGap(error, 'exercise_variants')) {
        console.warn('Sync variantes ignorée (migration SQL manquante).');
        return;
      }
      fail(error, ctx, status);
    }
    const existing = parseRows(data, idAndName, 'exercise_variants');
    const oldNames = new Map(existing.map((e) => [e.id, e.name]));
    const kept = new Set(variants.map((v) => v.id).filter((v): v is string => v !== null));
    const toDelete = existing.map((e) => e.id).filter((e) => !kept.has(e));
    if (toDelete.length > 0) await must(db.from('exercise_variants').delete().in('id', toDelete), ctx);
    for (const v of variants) {
      if (v.id) {
        const oldName = oldNames.get(v.id);
        if (oldName !== undefined && oldName !== v.name) await relabelPerformances(id, v.id, oldName, v.name);
        await must(db.from('exercise_variants').update({ name: v.name, is_default: v.isDefault }).eq('id', v.id), ctx);
      } else {
        await must(db.from('exercise_variants').insert([{ exercise_id: id, name: v.name, is_default: v.isDefault }]), ctx, INSERT_ONCE);
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
        db.from('exercises').insert([{ name: p.name, description: p.description, is_custom: true }]).select('id').single(), ctx, INSERT_ONCE);
      const id = idOf(row);
      if (id === null) throw new Error(`${ctx} : id manquant.`);
      await writeMuscles(id, p, ctx);
      const { error, status } = await run(
        db.from('exercise_variants').insert(p.variants.map((v) => ({ exercise_id: id, name: v.name, is_default: v.isDefault }))), ctx, INSERT_ONCE);
      if (error && !isSchemaGap(error, 'exercise_variants')) fail(error, ctx, status);
      return readOne(id);
    },

    async update(id, draft) {
      const ctx = "Mise à jour de l'exercice";
      const p = prepareExercise(draft, id);
      const base = { name: p.name, description: p.description };
      const { error, status } = await run(db.from('exercises').update({ ...base, updated_at: new Date().toISOString() }).eq('id', id), ctx);
      if (error) {
        // Anciennes bases sans colonne `updated_at`.
        if (!isSchemaGap(error, 'updated_at')) fail(error, ctx, status);
        await must(db.from('exercises').update(base).eq('id', id), ctx);
      }
      const current = await run(db.from('exercises_with_muscles').select('muscle_groups').eq('id', id).single(), ctx);
      if (current.error || !sameMuscles(current.data, p.muscleGroups)) {
        await must(db.from('muscle_groups').delete().eq('exercise_id', id), ctx);
        await writeMuscles(id, p, ctx);
      }
      await syncVariants(id, p.variants);
      return readOne(id);
    },

    async remove(id) {
      await must(db.from('exercises').delete().eq('id', id), "Suppression de l'exercice");
    },
  };
}
