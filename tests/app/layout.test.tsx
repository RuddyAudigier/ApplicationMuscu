import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Sheet } from '../../src/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from '../../src/app/Layout';
import { Providers } from '../../src/app/providers';
import { createMockBackend } from '../../src/data/mock';
import { OFFLINE_QUEUE_KEY } from '../../src/data/offlineQueue';
import { useAndroidBackButton } from '../../src/platform/backButton';

vi.mock('../../src/platform/backButton', () => ({ useAndroidBackButton: vi.fn() }));

const batch = {
  createdAt: '2026-11-20T10:00:00.000Z',
  payload: [{
    exerciseId: null, exerciseName: 'Squat', sessionName: 'S', reps: 5, weight: 100, rpe: null,
    variantId: null, variantName: '', serieNumber: 1, performanceDate: '2026-11-20',
  }],
};

function SheetPage() {
  const [open, setOpen] = useState(true);
  return (
    <Sheet open={open} title="Modale" onClose={() => { setOpen(false); }}>
      <p>contenu</p>
    </Sheet>
  );
}

function renderLayout() {
  const router = createMemoryRouter(
    [{ element: <Layout />, children: [{ path: '/', element: <h1>Accueil</h1> }, { path: '/settings', element: <h1>Réglages</h1> }] }],
    { initialEntries: ['/', '/settings'], initialIndex: 1 },
  );
  const backend = createMockBackend(localStorage);
  render(
    <Providers backend={backend}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { router, backend };
}

describe('Layout', () => {
  beforeEach(() => {
    vi.mocked(useAndroidBackButton).mockClear();
  });

  it('rejoue la file hors-ligne au montage', async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([batch]));
    const { backend } = renderLayout();
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    await waitFor(() => { expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull(); });
    expect((await backend.performances.list()).some((p) => p.exerciseName === 'Squat')).toBe(true);
  });

  it('bouton retour Android : ferme la modale ouverte au lieu de naviguer', () => {
    const router = createMemoryRouter(
      [{
        element: <Layout />,
        children: [
          { path: '/', element: <h1>Accueil</h1> },
          { path: '/settings', element: <SheetPage /> },
        ],
      }],
      { initialEntries: ['/', '/settings'], initialIndex: 1 },
    );
    render(
      <Providers backend={createMockBackend(localStorage)}>
        <RouterProvider router={router} />
      </Providers>,
    );
    expect(screen.getByRole('dialog', { name: 'Modale' })).toBeInTheDocument();
    const intercept = vi.mocked(useAndroidBackButton).mock.calls.at(-1)?.[1];
    let handled = false;
    act(() => { handled = intercept?.() ?? false; });
    expect(handled).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/settings');
    let again = true;
    act(() => { again = intercept?.() ?? true; });
    expect(again).toBe(false);
  });

  it('branche le bouton retour Android sur la navigation', async () => {
    const { router } = renderLayout();
    const handler = vi.mocked(useAndroidBackButton).mock.calls.at(-1)?.[0];
    expect(handler).toBeTypeOf('function');
    act(() => { handler?.(-1); });
    await waitFor(() => { expect(router.state.location.pathname).toBe('/'); });
  });
});
