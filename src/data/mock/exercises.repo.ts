import type { Exercise, Id } from '../../domain/model';
import type { ExercisesRepo } from '../ports';
import { prepareExercise } from '../shared/rules';
import { task, type MockContext, type MockDb, type MockExercise } from './db';
import { withVariantIds } from './seed';

const toExercise = (e: MockExercise, db: MockDb): Exercise => ({
  ...e,
  coachNotes: db.coachNotesByExerciseId[e.id]?.notes ?? '',
});

function find(db: MockDb, id: Id): MockExercise {
  const e = db.exercises.find((x) => x.id === id);
  if (!e) throw new Error('Exercice introuvable.');
  return e;
}

export function createMockExercisesRepo(ctx: MockContext): ExercisesRepo {
  return {
    // Tri stable `created_at` desc, comme la vue Supabase.
    list: () => task(() => {
      const db = ctx.read();
      return [...db.exercises].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((e) => toExercise(e, db));
    }),

    create: (draft) => task(() => {
      const p = prepareExercise(draft, null);
      return ctx.write((db) => {
        const id = ctx.genId('exercise');
        const e: MockExercise = {
          id, name: p.name, description: p.description, muscleGroups: p.muscleGroups,
          variants: withVariantIds(p.variants, id, ctx.genId), isCustom: true, createdAt: ctx.now().toISOString(),
        };
        db.exercises.unshift(e);
        return toExercise(e, db);
      });
    }),

    update: (id, draft) => task(() => {
      const p = prepareExercise(draft, id);
      return ctx.write((db) => {
        const e = find(db, id);
        Object.assign(e, {
          name: p.name, description: p.description, muscleGroups: p.muscleGroups,
          variants: withVariantIds(p.variants, id, ctx.genId),
        });
        return toExercise(e, db);
      });
    }),

    /** Cascade comme les FK supposées côté Supabase ; les performances restent (jamais supprimées). */
    remove: (id) => task(() => {
      ctx.write((db) => {
        db.exercises = db.exercises.filter((e) => e.id !== id);
        db.sessionExercises = db.sessionExercises.filter((se) => se.exerciseId !== id);
        Reflect.deleteProperty(db.coachNotesByExerciseId, id);
      });
    }),
  };
}
