import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { createTestRouter } from '../../../src/app/router';
import { BackendProvider } from '../../../src/data/context';
import { createMockBackend } from '../../../src/data/mock';
import type { DataBackend } from '../../../src/data/ports';
import type { PerformanceInput } from '../../../src/domain/model';
import { UiProvider } from '../../../src/ui';

/** Lundi 23 novembre 2026, 10 h locale. */
export const NOW = new Date(2026, 10, 23, 10, 0, 0);

export function renderAt(path: string, backend: DataBackend = createMockBackend(localStorage)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createTestRouter([path]);
  const utils = render(
    <QueryClientProvider client={client}>
      <BackendProvider backend={backend}>
        <UiProvider>
          <RouterProvider router={router} />
        </UiProvider>
      </BackendProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, backend };
}

export async function exerciseIds(backend: DataBackend): Promise<{ bench: string; squat: string; pauseId: string | null }> {
  const list = await backend.exercises.list();
  const bench = list.find((e) => e.name === 'Développé couché');
  const squat = list.find((e) => e.name === 'Squat');
  if (!bench || !squat) throw new Error('seed');
  return { bench: bench.id, squat: squat.id, pauseId: bench.variants.find((v) => v.name === 'Pause')?.id ?? null };
}

export const benchPerf = (benchId: string, over: Partial<PerformanceInput> = {}): PerformanceInput => ({
  exerciseId: benchId,
  exerciseName: 'Développé couché',
  sessionName: 'S',
  reps: 3,
  weight: 100,
  rpe: 9,
  variantId: null,
  variantName: 'Touch and Go',
  serieNumber: 1,
  performanceDate: '2026-11-23',
  ...over,
});
