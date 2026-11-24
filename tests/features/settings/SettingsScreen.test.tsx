import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackendProvider } from '@/data/queries';
import { UiProvider } from '@/ui';
import { createMockBackend } from '@/data/mock';
import { MOCK_QUEUE_KEYS } from '@/data/offlineQueue';
import { NetworkError, type DataBackend } from '@/data/ports';
import { todayIso } from '@/domain/dates';
import { applyPreferences, DISPLAY_PREFS_KEY, SettingsScreen } from '@/features/settings';

const daysAgo = (n: number) => todayIso(new Date(Date.now() - n * 86_400_000));

const batch = { createdAt: '2026-11-20T10:00:00.000Z', payload: [{
  exerciseId: null, exerciseName: 'Squat', sessionName: 'S', reps: 5, weight: 100, rpe: null,
  variantId: null, variantName: '', serieNumber: 1, performanceDate: '2026-11-20',
}] };

function setup(backend: DataBackend = createMockBackend(localStorage), initialEntries = ['/', '/settings']) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Accueil</h1> },
      { path: '/settings', element: <SettingsScreen /> },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BackendProvider backend={backend}>
        <UiProvider>
          <RouterProvider router={router} />
        </UiProvider>
      </BackendProvider>
    </QueryClientProvider>,
  );
  return { backend, router, user: userEvent.setup() };
}

afterEach(() => {
  applyPreferences({ reduceMotion: false, fontScale: '100' });
});

describe('SettingsScreen', () => {
  it('affiche les sections et revient en arrière', async () => {
    const { router, user } = setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Réglages' })).toBeInTheDocument();
    for (const name of ['Cycle en cours', 'Hors-ligne', 'Affichage', 'Données', 'À propos']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText(/méthode fontesque/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    expect(router.state.location.pathname).toBe('/');
  });

  it('revient à l’accueil quand Réglages est ouvert sans historique interne', async () => {
    const { router, user } = setup(undefined, ['/settings']);
    expect(router.state.location.key).toBe('default');
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    expect(router.state.location.pathname).toBe('/');
  });

  it('règle manuellement le cycle courant et sa date de début', async () => {
    const { backend, user } = setup();
    const cycle = await screen.findByRole('radiogroup', { name: 'Cycle courant' });
    expect(within(cycle).getByRole('radio', { name: 'Cycle A' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(cycle).getByRole('radio', { name: 'Cycle B' }));
    fireEvent.change(screen.getByLabelText('Début du cycle'), { target: { value: daysAgo(3) } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer le cycle' }));
    await waitFor(async () => {
      expect(await backend.cycles.get()).toEqual({ current: 'B', startedOn: daysAgo(3), lengthDays: 14, extraDays: 0 });
    });
    expect(await screen.findByText('Cycle enregistré.')).toBeInTheDocument();
  });

  it('conserve la durée prolongée et refuse une date vide ou future', async () => {
    const backend = createMockBackend(localStorage);
    await backend.cycles.save({ current: 'A', startedOn: daysAgo(5), lengthDays: 14, extraDays: 7 });
    const { user } = setup(backend);
    const date = await screen.findByLabelText('Début du cycle');
    expect(date).toHaveValue(daysAgo(5));
    const submit = () => user.click(screen.getByRole('button', { name: 'Enregistrer le cycle' }));
    fireEvent.change(date, { target: { value: '' } });
    await submit();
    expect(screen.getByText('Choisis une date de début.')).toBeInTheDocument();
    fireEvent.change(date, { target: { value: todayIso(new Date(Date.now() + 3 * 86_400_000)) } });
    await submit();
    expect(screen.getByText('La date de début ne peut pas être dans le futur.')).toBeInTheDocument();
    fireEvent.change(date, { target: { value: daysAgo(1) } });
    await submit();
    await waitFor(async () => {
      expect(await backend.cycles.get()).toEqual({ current: 'A', startedOn: daysAgo(1), lengthDays: 14, extraDays: 7 });
    });
    expect(screen.queryByText('La date de début ne peut pas être dans le futur.')).toBeNull();
  });

  it('état périmé : préremplit le bloc qui contient aujourd’hui et l’enregistre tel quel', async () => {
    const backend = createMockBackend(localStorage);
    await backend.cycles.save({ current: 'A', startedOn: daysAgo(20), lengthDays: 14, extraDays: 0 });
    const { user } = setup(backend);
    const cycle = await screen.findByRole('radiogroup', { name: 'Cycle courant' });
    expect(within(cycle).getByRole('radio', { name: 'Cycle B' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Début du cycle')).toHaveValue(daysAgo(6));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le cycle' }));
    await waitFor(async () => {
      expect(await backend.cycles.get()).toEqual({ current: 'B', startedOn: daysAgo(6), lengthDays: 14, extraDays: 0 });
    });
  });

  it('signale un échec d’enregistrement du cycle', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.cycles, 'save').mockRejectedValue(new Error('boom'));
    const { user } = setup(backend);
    await user.click(await screen.findByRole('button', { name: 'Enregistrer le cycle' }));
    expect(await screen.findByText(/Le cycle n’a pas pu être enregistré/)).toBeInTheDocument();
  });

  it('cycle illisible : message honnête, pas de formulaire sur des valeurs par défaut', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.cycles, 'get').mockRejectedValue(new Error('boom'));
    setup(backend);
    expect(await screen.findByText(/Le cycle n’a pas pu être chargé/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer le cycle' })).toBeNull();
  });

  it('hors-ligne : rien en attente', () => {
    setup();
    expect(screen.getByText('Aucune donnée en attente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Synchroniser' })).toBeDisabled();
  });

  it('hors-ligne : synchronise les lots en attente', async () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.queue, JSON.stringify([batch]));
    const { backend, user } = setup();
    expect(screen.getByText('1 lot en attente d’envoi.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Synchroniser' }));
    expect(await screen.findByText('1 lot envoyé.')).toBeInTheDocument();
    expect(screen.getByText('Aucune donnée en attente.')).toBeInTheDocument();
    expect((await backend.performances.list()).some((p) => p.exerciseName === 'Squat')).toBe(true);
  });

  it('hors-ligne : toujours sans réseau, les lots restent en attente', async () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.queue, JSON.stringify([batch, batch]));
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.performances, 'add').mockRejectedValue(new NetworkError('offline'));
    const { user } = setup(backend);
    expect(screen.getByText('2 lots en attente d’envoi.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Synchroniser' }));
    expect(await screen.findByText(/Rien n’a pu être envoyé/)).toBeInTheDocument();
    expect(localStorage.getItem(MOCK_QUEUE_KEYS.queue)).not.toBeNull();
  });

  it('hors-ligne : lot refusé archivé pendant la synchro', async () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.queue, JSON.stringify([{ ...batch, payload: [{ bad: true }] }]));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Synchroniser' }));
    expect(await screen.findByText(/1 lot refusé/)).toBeInTheDocument();
    expect(screen.getByText(/1 élément archivé à vérifier \(refusés ou incertains\)/)).toBeInTheDocument();
  });

  it('hors-ligne : synchro interrompue (stockage) sans prétendre que tout est conservé', async () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.queue, JSON.stringify([batch]));
    const { user } = setup();
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: 'Synchroniser' }));
    expect(await screen.findByText(/Une partie a pu être envoyée ; le reste est conservé/)).toBeInTheDocument();
    expect(screen.queryByText(/sont conservées\./)).toBeNull();
    spy.mockRestore();
  });

  it('hors-ligne : explique honnêtement les archives et la file illisible, sans rien supprimer', () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.queue, '{illisible');
    localStorage.setItem(MOCK_QUEUE_KEYS.failed, JSON.stringify([{ ...batch, reason: 'rejected' }, { ...batch, reason: 'uncertain' }]));
    localStorage.setItem(MOCK_QUEUE_KEYS.corrupt, JSON.stringify(['{old']));
    setup();
    expect(screen.getByText(/2 éléments archivés à vérifier \(refusés ou incertains\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 sauvegarde illisible/)).toBeInTheDocument();
    expect(screen.getByText(/La file d’attente est illisible/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Supprimer|Vider/ })).toBeNull();
    expect(localStorage.getItem(MOCK_QUEUE_KEYS.failed)).not.toBeNull();
    expect(localStorage.getItem(MOCK_QUEUE_KEYS.corrupt)).not.toBeNull();
  });

  it('hors-ligne : file bloquée par une erreur transitoire, affichée avec son message', () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.queue, JSON.stringify([{ ...batch, attempts: 3, lastError: 'JWT expired' }]));
    setup();
    expect(screen.getByText(/Envoi bloqué : le serveur refuse pour l’instant \(JWT expired\)/)).toBeInTheDocument();
  });

  it('hors-ligne : renvoie les éléments archivés en fin de file', async () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.failed, JSON.stringify([{ ...batch, reason: 'rejected', error: 'x' }]));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Renvoyer les éléments archivés' }));
    expect(await screen.findByText('1 lot remis en file d’envoi.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(MOCK_QUEUE_KEYS.queue) ?? '[]')).toEqual([batch]);
    expect(localStorage.getItem(MOCK_QUEUE_KEYS.failed)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Renvoyer les éléments archivés' })).toBeNull();
  });

  it('affichage : réduit les animations et change la taille du texte (persisté)', async () => {
    const { user } = setup();
    const motion = screen.getByRole('switch', { name: 'Réduire les animations' });
    expect(motion).toHaveAttribute('aria-checked', 'false');
    await user.click(motion);
    expect(motion).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveAttribute('data-reduce-motion');
    await user.click(screen.getByRole('radio', { name: 'Très grand' }));
    expect(document.documentElement).toHaveAttribute('data-font-scale', '120');
    expect(JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) ?? '{}')).toEqual({ reduceMotion: true, fontScale: '120' });
    await user.click(motion);
    expect(document.documentElement).not.toHaveAttribute('data-reduce-motion');
  });

  it('données (mock) : réinitialise après confirmation, file hors-ligne comprise', async () => {
    localStorage.setItem(MOCK_QUEUE_KEYS.queue, JSON.stringify([batch]));
    localStorage.setItem(MOCK_QUEUE_KEYS.failed, JSON.stringify([{ ...batch, reason: 'rejected' }]));
    const backend = createMockBackend(localStorage);
    const reset = vi.spyOn(backend, 'reset');
    const { user } = setup(backend);
    expect(screen.getByText(/Mode démo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les données de démo' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Réinitialiser les données de démo ?' });
    expect(within(dialog).getByText(/file hors-ligne/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(reset).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les données de démo' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Réinitialiser' }));
    await waitFor(() => { expect(reset).toHaveBeenCalledTimes(1); });
    expect(await screen.findByText('Données de démo réinitialisées.')).toBeInTheDocument();
    expect(screen.getByText('Aucune donnée en attente.')).toBeInTheDocument();
    expect(screen.queryByText(/archivé/)).toBeNull();
  });

  it('données (mock) : échec de réinitialisation', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend, 'reset').mockRejectedValue(new Error('boom'));
    const { user } = setup(backend);
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les données de démo' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Réinitialiser' }));
    expect(await screen.findByText(/La réinitialisation a échoué/)).toBeInTheDocument();
  });

  it('données (Supabase) : affiche le backend sans proposer de réinitialisation', () => {
    const backend: DataBackend = { ...createMockBackend(localStorage), kind: 'supabase', reset: undefined };
    setup(backend);
    expect(screen.getByText('Données synchronisées avec Supabase.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réinitialiser les données de démo' })).toBeNull();
  });
});
