import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createBackend } from '../data/backend';
import { BackendProvider } from '../data/context';
import type { DataBackend } from '../data/ports';
import { UiProvider } from '../ui';

/* Le contexte vit dans `data/` (les hooks de requêtes en dépendent) ; ré-exporté pour `app`. */
export { BackendProvider, useBackend } from '../data/context';

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
