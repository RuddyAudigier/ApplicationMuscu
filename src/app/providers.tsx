import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createBackend } from '../data/backend';
import type { DataBackend } from '../data/ports';
import { UiProvider } from '../ui';

const BackendContext = createContext<DataBackend | null>(null);

export function useBackend(): DataBackend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error('Backend non configuré');
  return backend;
}

export function BackendProvider({ backend, children }: { backend: DataBackend; children: ReactNode }) {
  return <BackendContext value={backend}>{children}</BackendContext>;
}

/** `backend` injectable (tests) ; sinon créé une seule fois depuis l'environnement (INV §4). */
export function Providers({ children, backend }: { children: ReactNode; backend?: DataBackend }) {
  const [client] = useState(() => new QueryClient());
  const [data] = useState(() => backend ?? createBackend());
  return (
    <QueryClientProvider client={client}>
      <BackendProvider backend={data}>
        <UiProvider>{children}</UiProvider>
      </BackendProvider>
    </QueryClientProvider>
  );
}
