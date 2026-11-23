import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackendProvider } from '@/data/queries';
import { createTestRouter } from '@/app/router';
import { createMockBackend } from '@/data/mock';
import type { DataBackend } from '@/data/ports';
import type { CycleState, Session } from '@/domain/model';
import { startWorkout } from '@/domain/workout';
import { loadActiveWorkout, loadLastReport, saveActiveWorkout, saveLastReport } from '@/features/workout';

const A1: Session = {
  id: 's1', name: 'A1 · Haut du corps', createdAt: '2026-01-01T00:00:00Z', cycle: 'A',
  exercises: [{ exerciseId: 'e1', name: 'Développé couché', series: 3 }, { exerciseId: 'e2', name: 'Squat', series: 2 }],
};

function backendWith(over: { sessions?: Session[]; cycle?: CycleState | null; sessionsError?: boolean } = {}): DataBackend {
  const base = createMockBackend(localStorage);
  return {
    ...base,
    sessions: {
      ...base.sessions,
      list: over.sessionsError
        ? () => Promise.reject(new Error('réseau'))
        : over.sessions ? () => Promise.resolve(over.sessions ?? []) : () => base.sessions.list(),
    },
    cycles: {
      ...base.cycles,
      get: () => Promise.resolve(over.cycle === undefined ? null : over.cycle),
    },
  };
}

function renderHome(backend: DataBackend = backendWith()) {
  const router = createTestRouter(['/']);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BackendProvider backend={backend}>
        <RouterProvider router={router} />
      </BackendProvider>
    </QueryClientProvider>,
  );
  return router;
}

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 26, 10, 0)); // jeudi 26/11/2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche la marque, les réglages et le cycle en cours', async () => {
    renderHome(backendWith({ cycle: { current: 'A', startedOn: '2026-11-16', weeks: 2 } }));
    expect(screen.getByRole('heading', { level: 1, name: 'Accueil' })).toBeInTheDocument();
    expect(screen.getByText('mymuscle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/settings');
    expect(await screen.findByRole('heading', { name: 'Cycle A' })).toBeInTheDocument();
    expect(screen.getByText('Semaine 2 sur 2')).toBeInTheDocument();
    expect(screen.getByText('dans 4 jours')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Frise des cycles : cycle B terminé, cycle A en cours, puis cycle B/ }))
      .toBeInTheDocument();
  });

  it('utilise le cycle par défaut (A, semaine 1) sans état enregistré', async () => {
    renderHome();
    expect(await screen.findByRole('heading', { name: 'Cycle A' })).toBeInTheDocument();
    expect(screen.getByText('Semaine 1 sur 2')).toBeInTheDocument();
    expect(screen.getByText('dans 14 jours')).toBeInTheDocument();
  });

  it('prolongé à 3 semaines : 3 segments en cours et un jour au singulier', async () => {
    renderHome(backendWith({ cycle: { current: 'B', startedOn: '2026-11-06', weeks: 3 } }));
    expect(await screen.findByText('Semaine 3 sur 3')).toBeInTheDocument();
    expect(screen.getByText('dans 1 jour')).toBeInTheDocument();
  });

  it('propose la séance du jour et la démarre', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    saveLastReport({ exercises: [], title: 'Ancien', prCount: 0 } as never);
    const router = renderHome(backendWith({ sessions: [A1] }));
    const card = await screen.findByRole('button', { name: 'Démarrer A1 · Haut du corps' });
    expect(card).toHaveTextContent('Séance du jour · Cycle A');
    expect(card).toHaveTextContent('5séries prévuessur 2 exercices');
    await waitFor(() => { expect(card).toBeEnabled(); });
    await user.click(card);
    await waitFor(() => { expect(router.state.location.pathname).toBe('/workout'); });
    expect(loadActiveWorkout()).toMatchObject({ sessionId: 's1', date: '2026-11-26' });
    expect(loadLastReport()).toBeNull();
  });

  it('propose de reprendre une séance en cours', () => {
    const state = startWorkout(A1, [], new Date());
    const first = state.exercises[0];
    if (first?.series[0]) first.series[0] = { ...first.series[0], validated: true };
    saveActiveWorkout(state);
    renderHome();
    const link = screen.getByRole('link', { name: 'Reprendre A1 · Haut du corps' });
    expect(link).toHaveAttribute('href', '/workout');
    expect(link).toHaveTextContent('Séance en cours · Cycle A');
    expect(link).toHaveTextContent('1série validée');
  });

  it('sans séance : CTA vers le programme', async () => {
    renderHome(backendWith({ sessions: [] }));
    expect(await screen.findByRole('heading', { name: 'Aucune séance' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer mon programme' })).toHaveAttribute('href', '/program');
  });

  it('aucune séance dans le cycle en cours', async () => {
    renderHome(backendWith({ sessions: [{ ...A1, cycle: 'B' }] }));
    expect(await screen.findByRole('heading', { name: 'Aucune séance dans le cycle A' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le programme' })).toHaveAttribute('href', '/program');
  });

  it('signale une erreur de chargement', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderHome(backendWith({ sessionsError: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger les séances');
  });

  it('affiche les 3 derniers PR calculés et le dernier compte rendu', async () => {
    saveLastReport({ exercises: [], title: 'Séance test', prCount: 2 } as never);
    renderHome();
    expect(screen.getByRole('link', { name: /Dernier compte rendu/ })).toHaveAttribute('href', '/report');
    expect(screen.getByRole('link', { name: /Dernier compte rendu/ })).toHaveTextContent('2 PR');
    const section = await screen.findByRole('region', { name: 'Derniers PR' });
    const items = await within(section).findAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[2]).toHaveTextContent('Développé couché');
    expect(items[2]).toHaveTextContent('Record reps · 05/03');
    expect(items[2]).toHaveTextContent('6 × 90 kg');
    expect(screen.getAllByText(/Record charge/)).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Tout voir' })).toHaveAttribute('href', '/records');
  });

  it('sans PR : message honnête', async () => {
    const base = createMockBackend(localStorage);
    renderHome({ ...base, performances: { ...base.performances, list: () => Promise.resolve([]) } });
    expect(await screen.findByText(/Aucun PR pour l’instant/)).toBeInTheDocument();
  });
});
