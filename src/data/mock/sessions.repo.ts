import type { Id, Session } from '../../domain/model';
import type { SessionsRepo } from '../ports';
import { prepareSession } from '../supabase/mappers';
import { task, type MockContext, type MockDb } from './db';

type MockSession = MockDb['sessions'][number];

/** Exercices disparus ignorés, comme la jointure Supabase (D12). */
function toSession(db: MockDb, s: MockSession): Session {
  const exercises = db.sessionExercises
    .filter((se) => se.sessionId === s.id)
    .flatMap((se) => {
      const ex = db.exercises.find((e) => e.id === se.exerciseId);
      return ex ? [{ exerciseId: ex.id, name: ex.name, series: se.seriesCount }] : [];
    });
  return { id: s.id, name: s.name, createdAt: s.createdAt, exercises };
}

function find(db: MockDb, id: Id): MockSession {
  const s = db.sessions.find((x) => x.id === id);
  if (!s) throw new Error('Séance introuvable.');
  return s;
}

export function createMockSessionsRepo(ctx: MockContext): SessionsRepo {
  return {
    list: () => task(() => {
      const db = ctx.read();
      return [...db.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((s) => toSession(db, s));
    }),

    create: (draft) => task(() => {
      const d = prepareSession(draft);
      return ctx.write((db) => {
        const s = { id: ctx.genId('session'), name: d.name, createdAt: ctx.now().toISOString() };
        db.sessions.unshift(s);
        db.sessionExercises.push(...d.exercises.map((e) => ({ sessionId: s.id, exerciseId: e.exerciseId, seriesCount: e.series })));
        return toSession(db, s);
      });
    }),

    /** Renommage propagé aux performances liées par nom (D5). */
    update: (id, draft) => task(() => {
      const d = prepareSession(draft);
      return ctx.write((db) => {
        const s = find(db, id);
        const oldName = s.name;
        s.name = d.name;
        db.sessionExercises = [
          ...db.sessionExercises.filter((se) => se.sessionId !== id),
          ...d.exercises.map((e) => ({ sessionId: id, exerciseId: e.exerciseId, seriesCount: e.series })),
        ];
        if (oldName !== d.name) {
          for (const p of db.performances) if (p['session_name'] === oldName) p['session_name'] = d.name;
        }
        return toSession(db, s);
      });
    }),

    /** Les performances de la séance restent (liées par nom). */
    remove: (id) => task(() => {
      ctx.write((db) => {
        db.sessions = db.sessions.filter((s) => s.id !== id);
        db.sessionExercises = db.sessionExercises.filter((se) => se.sessionId !== id);
      });
    }),
  };
}
