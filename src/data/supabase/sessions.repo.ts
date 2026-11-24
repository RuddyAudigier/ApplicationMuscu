import type { Id, Session, SessionDraft } from '../../domain/model';
import type { SessionsRepo } from '../ports';
import { type Db, fail, isSchemaGap, must, type PgResult, run } from './client';
import type { CycleFallback } from './cycleFallback';
import { parseRows, prepareSession } from '../shared/rules';
import { mapSessionRow } from './mappers';

/** Colonnes `sessions.cycle` et `session_exercises.position` incluses seulement si présentes. */
const sessionSelect = (cycle: boolean, position: boolean): string =>
  `id, name, created_at, ${cycle ? 'cycle, ' : ''}`
  + `session_exercises(series_count, exercise_id, ${position ? 'position, ' : ''}exercises(name))`;

/** `position` = rang dans le brouillon (ordre des exercices, migration 2026-11-23). */
const links = (sessionId: Id, d: SessionDraft, withPosition: boolean) =>
  d.exercises.map((e, i) => ({
    session_id: sessionId, exercise_id: e.exerciseId, series_count: e.series, ...(withPosition ? { position: i } : {}),
  }));

/**
 * Colonne `sessions.cycle` : lue et écrite si elle existe. Absente (`42703`/`PGRST204`…) → la requête
 * est rejouée sans elle et le cycle est stocké en local (`CycleFallback`). L'absence est mémorisée
 * pour la durée du backend (rechargement de l'app après la migration). Le stockage local n'est lu
 * et écrit QUE tant que la colonne est absente : en base, `NULL` signifie « hors cycle ».
 */
export function createSessionsRepo(db: Db, fallback: CycleFallback): SessionsRepo {
  let hasCycleColumn = true;
  /** `session_exercises.position` absente → ordre renvoyé par la base (aucun repli local). */
  let hasPositionColumn = true;

  /**
   * Lecture avec les colonnes optionnelles connues. Sur schéma incomplet, retire la colonne
   * en cause (message citant `position`, sinon `cycle`, puis `position`) et rejoue.
   */
  async function readSessions(build: (cols: string) => PromiseLike<PgResult>, ctx: string): Promise<unknown> {
    for (;;) {
      const { data, error, status } = await run(build(sessionSelect(hasCycleColumn, hasPositionColumn)), ctx);
      if (!error) return data;
      if (!isSchemaGap(error)) fail(error, ctx, status);
      if (hasPositionColumn && error.message.toLowerCase().includes('position')) {
        hasPositionColumn = false;
      } else if (hasCycleColumn) {
        hasCycleColumn = false;
        fallback.warn();
      } else if (hasPositionColumn) {
        hasPositionColumn = false;
      } else {
        fail(error, ctx, status);
      }
    }
  }

  /** Insère les liens avec `position` ; colonne absente → rejoue sans et le mémorise. */
  async function insertLinks(id: Id, d: SessionDraft, ctx: string): Promise<void> {
    if (hasPositionColumn) {
      const { error, status } = await run(db.from('session_exercises').insert(links(id, d, true)), ctx);
      if (!error) return;
      if (!isSchemaGap(error)) fail(error, ctx, status);
      hasPositionColumn = false;
    }
    await must(db.from('session_exercises').insert(links(id, d, false)), ctx);
  }

  /** Écriture de `sessions` : tente avec la colonne cycle ; sur schéma incomplet, bascule en repli. */
  async function withCycle(withCol: () => PromiseLike<PgResult>, without: () => PromiseLike<PgResult>, ctx: string): Promise<unknown> {
    if (hasCycleColumn) {
      const { data, error, status } = await run(withCol(), ctx);
      if (!error) return data;
      if (!isSchemaGap(error)) fail(error, ctx, status);
      hasCycleColumn = false;
      fallback.warn();
    }
    return must(without(), ctx);
  }

  /** En repli uniquement : le cycle vient du stockage local. */
  const withLocalCycle = (s: Session): Session => (hasCycleColumn ? s : { ...s, cycle: fallback.sessionCycle(s.id) });

  /** En repli uniquement : mémorise le cycle en local ; une erreur de stockage fait échouer l'appel. */
  const rememberCycle = (id: Id, cycle: SessionDraft['cycle']): void => {
    if (!hasCycleColumn) fallback.setSessionCycle(id, cycle);
  };

  async function readOne(id: Id): Promise<Session> {
    const ctx = 'Lecture de la séance';
    const one = (cols: string) => db.from('sessions').select(cols).eq('id', id).single();
    const s = mapSessionRow(await readSessions(one, ctx));
    if (!s) throw new Error(`${ctx} : réponse invalide.`);
    return withLocalCycle(s);
  }

  return {
    /** Une seule requête avec jointure (D12). */
    async list() {
      const all = (cols: string) => db.from('sessions').select(cols).order('created_at', { ascending: false });
      const data = await readSessions(all, 'Lecture des séances');
      return parseRows(data, mapSessionRow, 'sessions').map(withLocalCycle);
    },

    async create(draft) {
      const ctx = 'Création de la séance';
      const d = prepareSession(draft);
      const insert = (row: object) => db.from('sessions').insert([row]).select('id').single();
      const row = await withCycle(() => insert({ name: d.name, cycle: d.cycle }), () => insert({ name: d.name }), ctx);
      const id = (row as { id?: unknown } | null)?.id;
      if (typeof id !== 'string') throw new Error(`${ctx} : id manquant.`);
      await insertLinks(id, d, ctx);
      // Cycle local écrit en DERNIER : un échec de stockage ne laisse pas de séance sans exercices.
      // La séance est déjà validée en base : rejeter inviterait à recréer (doublon). Choix : on
      // résout avec la séance relue (`cycle: null`, signal visible) et on avertit en console.
      try {
        rememberCycle(id, d.cycle);
      } catch (e) {
        console.warn(
          `${ctx} : séance créée ; seul son cycle n'a pas pu être enregistré sur l'appareil `
          + `(${e instanceof Error ? e.message : String(e)}). Modifiez la séance pour le régler.`,
        );
      }
      return readOne(id);
    },

    /**
     * Non transactionnel (comme l'existant). Renommage (D5) : les performances liées par nom
     * sont renommées AVANT la séance, pour qu'un nouvel essai après échec voie encore l'ancien nom
     * (opération idempotente). Puis nom + cycle, puis delete + insert des exercices, puis (repli
     * uniquement) cycle local en dernier.
     */
    async update(id, draft) {
      const ctx = 'Mise à jour de la séance';
      const d = prepareSession(draft);
      const before = await readOne(id);
      if (before.name !== d.name) {
        await must(db.from('performances').update({ session_name: d.name }).eq('session_name', before.name), ctx);
      }
      const update = (values: object) => db.from('sessions').update(values).eq('id', id);
      await withCycle(() => update({ name: d.name, cycle: d.cycle }), () => update({ name: d.name }), ctx);
      await must(db.from('session_exercises').delete().eq('session_id', id), ctx);
      await insertLinks(id, d, ctx);
      rememberCycle(id, d.cycle);
      return readOne(id);
    },

    async remove(id) {
      await must(db.from('sessions').delete().eq('id', id), 'Suppression de la séance');
      rememberCycle(id, null);
    },
  };
}
