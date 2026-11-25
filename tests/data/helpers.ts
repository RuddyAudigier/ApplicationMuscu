import type { SupabaseClient } from '@supabase/supabase-js';

/** Storage en mémoire (Web Storage API) pour les tests. */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.map.keys())[index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

export function sequentialIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${String(++n)}`;
}

export interface FakeCall { table: string; ops: { m: string; args: unknown[] }[] }
export interface FakeResult { data: unknown; error: { code?: string; message: string } | null; status?: number }
export type Responder = (call: FakeCall) => FakeResult | Promise<FakeResult>;

/** Faux client Supabase chaînable : enregistre chaque requête, la résout via `respond`. */
export function fakeSupabase(respond: Responder): { client: SupabaseClient; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const builder = (call: FakeCall): unknown =>
    new Proxy({}, {
      get(_t, prop: string | symbol) {
        if (prop === 'then') {
          return (ok: (v: FakeResult) => unknown, ko: (e: unknown) => unknown) => {
            calls.push(call);
            return Promise.resolve().then(() => respond(call)).then(ok, ko);
          };
        }
        return (...args: unknown[]) => builder({ table: call.table, ops: [...call.ops, { m: String(prop), args }] });
      },
    });
  const client = { from: (table: string) => builder({ table, ops: [] }) };
  return { client: client as unknown as SupabaseClient, calls };
}

export const op = (call: FakeCall, m: string): unknown[] | undefined => call.ops.find((o) => o.m === m)?.args;
export const has = (call: FakeCall, m: string): boolean => call.ops.some((o) => o.m === m);
export const ok = (data: unknown): FakeResult => ({ data, error: null });
