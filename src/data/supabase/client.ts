import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NetworkError } from '../ports';

/** Erreur renvoyée par PostgREST / supabase-js. */
export interface PgError { code?: string; message: string }
export interface PgResult { data: unknown; error: PgError | null }

/**
 * Sous-ensemble chaînable du query builder supabase-js utilisé par les repos.
 * Les résultats restent `unknown` : chaque ligne est validée par Zod (mappers).
 */
interface Query extends PromiseLike<PgResult> {
  select(columns?: string): Query;
  insert(rows: object[]): Query;
  update(values: object): Query;
  upsert(rows: object[], options: { onConflict: string }): Query;
  delete(): Query;
  eq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  order(column: string, options: { ascending: boolean }): Query;
  range(from: number, to: number): Query;
  single(): Query;
}
export interface Db { from(table: string): Query }

/** Seul point de conversion : le client typé est vu via l'interface minimale `Db`. */
export function asDb(client: SupabaseClient): Db {
  return client as unknown as Db;
}

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  // Sans types de schéma générés : on fige la forme par défaut de `SupabaseClient`.
  const client: unknown = createClient(url, anonKey);
  return client as SupabaseClient;
}

/** Codes « schéma incomplet » tolérés (INV §2.4). */
const SCHEMA_GAP_CODES: readonly string[] = ['42P01', '42703', 'PGRST204'];
export const NO_ROWS = 'PGRST116';

export function isSchemaGap(error: PgError, keyword?: string): boolean {
  if (error.code !== undefined && SCHEMA_GAP_CODES.includes(error.code)) return true;
  return keyword !== undefined && error.message.toLowerCase().includes(keyword);
}

/** supabase-js renvoie `code: ''` quand `fetch` échoue (« TypeError: Failed to fetch »). */
function isNetworkError(error: PgError): boolean {
  return !error.code;
}

/**
 * Exécute une requête. Panne réseau (rejet, `TypeError`, erreur sans `code`) → `NetworkError`.
 * Les erreurs PostgREST codées sont renvoyées à l'appelant (fallbacks tolérés).
 */
export async function run(query: PromiseLike<PgResult>, context: string): Promise<PgResult> {
  let res: PgResult;
  try {
    res = await query;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof TypeError || /fetch|network/i.test(message)) {
      throw new NetworkError(`${context} : réseau indisponible (${message}).`);
    }
    throw e;
  }
  if (res.error && isNetworkError(res.error)) {
    throw new NetworkError(`${context} : réseau indisponible (${res.error.message}).`);
  }
  return res;
}

export function fail(error: PgError, context: string): never {
  throw new Error(`${context} : ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

/** Exécute et lève sur toute erreur ; renvoie `data`. */
export async function must(query: PromiseLike<PgResult>, context: string): Promise<unknown> {
  const { data, error } = await run(query, context);
  if (error) fail(error, context);
  return data;
}
