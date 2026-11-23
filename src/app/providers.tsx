import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { DataBackend } from '../data/ports';
import { UiProvider } from '../ui';

/** Stub : sera câblé à la sélection du backend (Task 6). */
export function useBackend(): DataBackend {
  throw new Error('Backend non configuré');
}

export function BackendProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <BackendProvider>
        <UiProvider>{children}</UiProvider>
      </BackendProvider>
    </QueryClientProvider>
  );
}
