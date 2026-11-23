import type { Id, Session, SessionDraft } from '../../domain/model';
import type { SessionsRepo } from '../ports';
import { type Db, must } from './client';
import { mapSessionRow, parseRows, prepareSession } from './mappers';

const SESSION_SELECT = 'id, name, created_at, session_exercises(series_count, exercise_id, exercises(name))';

const links = (sessionId: Id, d: SessionDraft) =>
  d.exercises.map((e) => ({ session_id: sessionId, exercise_id: e.exerciseId, series_count: e.series }));

export function createSessionsRepo(db: Db): SessionsRepo {
  async function readOne(id: Id): Promise<Session> {
    const ctx = 'Lecture de la séance';
    const s = mapSessionRow(await must(db.from('sessions').select(SESSION_SELECT).eq('id', id).single(), ctx));
    if (!s) throw new Error(`${ctx} : réponse invalide.`);
    return s;
  }

  return {
    /** Une seule requête avec jointure (D12). */
    async list() {
      const data = await must(db.from('sessions').select(SESSION_SELECT).order('created_at', { ascending: false }), 'Lecture des séances');
      return parseRows(data, mapSessionRow, 'sessions');
    },

    async create(draft) {
      const ctx = 'Création de la séance';
      const d = prepareSession(draft);
      const row = await must(db.from('sessions').insert([{ name: d.name }]).select('id').single(), ctx);
      const id = (row as { id?: unknown } | null)?.id;
      if (typeof id !== 'string') throw new Error(`${ctx} : id manquant.`);
      await must(db.from('session_exercises').insert(links(id, d)), ctx);
      return readOne(id);
    },

    /**
     * Non transactionnel (comme l'existant) : nom, puis delete + insert des exercices.
     * Renommage : les performances liées par nom suivent (D5).
     */
    async update(id, draft) {
      const ctx = 'Mise à jour de la séance';
      const d = prepareSession(draft);
      const before = await readOne(id);
      await must(db.from('sessions').update({ name: d.name }).eq('id', id), ctx);
      await must(db.from('session_exercises').delete().eq('session_id', id), ctx);
      await must(db.from('session_exercises').insert(links(id, d)), ctx);
      if (before.name !== d.name) {
        await must(db.from('performances').update({ session_name: d.name }).eq('session_name', before.name), ctx);
      }
      return readOne(id);
    },

    async remove(id) {
      await must(db.from('sessions').delete().eq('id', id), 'Suppression de la séance');
    },
  };
}
