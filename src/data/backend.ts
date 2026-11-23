import { createMockBackend } from './mock';
import type { DataBackend } from './ports';
import { createSupabaseBackend } from './supabase';
import { createSupabaseClient } from './supabase/client';

export interface BackendEnv {
  VITE_DATA_BACKEND?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const MOCK_VALUES = ['mock', 'local', 'test'];

/** Sélection INV §4 : `mock|local|test` (trim, minuscules) → mock ; sinon Supabase. */
export function createBackend(env: BackendEnv = import.meta.env): DataBackend {
  const kind = (env.VITE_DATA_BACKEND ?? '').trim().toLowerCase();
  if (MOCK_VALUES.includes(kind)) return createMockBackend();
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Configuration Supabase manquante : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
  return createSupabaseBackend(createSupabaseClient(url, key));
}
