import { createContext, useContext, type ReactNode } from 'react';
import type { DataBackend } from './ports';

const BackendContext = createContext<DataBackend | null>(null);

/** Backend de données courant (Supabase ou mock), fourni par `BackendProvider`. */
export function useBackend(): DataBackend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error('Backend non configuré');
  return backend;
}

export function BackendProvider({ backend, children }: { backend: DataBackend; children: ReactNode }) {
  return <BackendContext value={backend}>{children}</BackendContext>;
}
