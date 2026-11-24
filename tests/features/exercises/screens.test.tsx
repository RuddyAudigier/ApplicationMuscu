import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackendProvider } from '../../../src/data/queries';
import { UiProvider } from '../../../src/ui';
import { createMockBackend } from '../../../src/data/mock';
import type { DataBackend } from '../../../src/data/ports';
import { ExerciseDetailScreen, ExercisesScreen } from '../../../src/features/exercises';

function setup(path: string, backend: DataBackend = createMockBackend(localStorage)) {
  const router = createMemoryRouter(
    [
      { path: '/exercises', element: <ExercisesScreen /> },
      { path: '/exercises/:id', element: <ExerciseDetailScreen /> },
      { path: '/records/:exerciseId', element: <h1>Records</h1> },
    ],
    { initialEntries: [path] },
  );
  // Pas de nouvelle tentative automatique : les états d'erreur s'affichent tout de suite.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BackendProvider backend={backend}>
        <UiProvider>
          <RouterProvider router={router} />
        </UiProvider>
      </BackendProvider>
    </QueryClientProvider>,
  );
  return { router, backend, user: userEvent.setup() };
}

async function benchId(backend: DataBackend): Promise<string> {
  const list = await backend.exercises.list();
  const bench = list.find((e) => e.name === 'Développé couché');
  if (!bench) throw new Error('seed');
  return bench.id;
}

describe('ExercisesScreen', () => {
  it('lists exercises with their cycle badges', async () => {
    setup('/exercises');
    const link = await screen.findByRole('link', { name: /Développé couché/ });
    expect(within(link).getByText('Cycle', { exact: false })).toBeInTheDocument();
    expect(link).toHaveTextContent('A');
    expect(screen.getByText('2 exercices')).toBeInTheDocument();
  });

  it('searches without accents and by muscle alias, and filters by muscle', async () => {
    const { user } = setup('/exercises');
    await screen.findByRole('link', { name: /Squat/ });
    const search = screen.getByRole('searchbox', { name: 'Rechercher un exercice' });
    await user.type(search, 'developpe');
    expect(screen.queryByRole('link', { name: /Squat/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Développé couché/ })).toBeInTheDocument();
    expect(screen.getByText('1 sur 2')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'quads');
    expect(screen.getByRole('link', { name: /Squat/ })).toBeInTheDocument();
    await user.clear(search);

    const filters = screen.getByRole('group', { name: 'Filtrer par muscle' });
    await user.click(within(filters).getByRole('button', { name: 'Pectoraux' }));
    expect(within(filters).getByRole('button', { name: 'Pectoraux' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link', { name: /Squat/ })).toBeNull();
    await user.click(within(filters).getByRole('button', { name: 'Psoas' }));
    expect(screen.getByText('Aucun exercice trouvé')).toBeInTheDocument();
    await user.click(within(filters).getByRole('button', { name: 'Tous' }));
    expect(screen.getByRole('link', { name: /Squat/ })).toBeInTheDocument();
  });

  it('creates an exercise through a sheet and opens it', async () => {
    const { user, router, backend } = setup('/exercises');
    await screen.findByRole('link', { name: /Squat/ });
    await user.click(screen.getByRole('button', { name: 'Créer un exercice' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvel exercice' });
    await user.click(within(dialog).getByRole('button', { name: 'Créer l’exercice' }));
    expect(within(dialog).getByText("Le nom de l'exercice est requis.")).toBeInTheDocument();
    expect(within(dialog).getByText('Choisis au moins un muscle.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Nom'), 'Curl');
    await user.click(within(dialog).getByRole('button', { name: 'Biceps' }));
    await user.click(within(dialog).getByRole('button', { name: 'Créer l’exercice' }));

    await screen.findByRole('heading', { level: 1, name: 'Curl' });
    const created = (await backend.exercises.list()).find((e) => e.name === 'Curl');
    expect(created?.muscleGroups).toEqual(['Biceps']);
    expect(created?.variants).toHaveLength(1);
    expect(router.state.location.pathname).toBe(`/exercises/${created?.id ?? ''}`);
  });

  it('closes the creation sheet on Escape and resets it', async () => {
    const { user } = setup('/exercises');
    await screen.findByRole('link', { name: /Squat/ });
    await user.click(screen.getByRole('button', { name: 'Créer un exercice' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ExerciseDetailScreen', () => {
  it('shows a hidden title while loading and a not-found state', async () => {
    setup('/exercises/inconnu');
    expect(screen.getByRole('heading', { name: 'Fiche exercice' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Exercice introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour aux exercices' })).toHaveAttribute('href', '/exercises');
  });

  it('shows cycles, muscles, variants with best e1RM, the muscle map and the records link', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    setup(`/exercises/${id}`, backend);
    await screen.findByRole('heading', { level: 1, name: 'Développé couché' });
    expect(await screen.findByText('Cycle A')).toBeInTheDocument();
    expect(screen.getByText('Pectoraux')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Records' })).toHaveAttribute('href', `/records/${id}`);
    expect(screen.getByRole('img', { name: 'Carte musculaire : Pectoraux, Triceps' })).toBeInTheDocument();
    // 92,5 × (1 + 6/30) = 111
    const classic = await screen.findByRole('button', { name: /^Classique, Par défaut · 1 record, meilleur e1RM 111 kg/ });
    expect(classic).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pause, Aucun record, meilleur e1RM —/ })).toBeInTheDocument();
  });

  it('saves coach notes on blur and reports it', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const { user } = setup(`/exercises/${id}`, backend);
    const notes = await screen.findByRole('textbox', { name: /Remarques du coach/ });
    await user.type(notes, 'Omoplates serrées');
    await user.tab();
    expect(await screen.findByText('Remarques enregistrées.')).toBeInTheDocument();
    expect((await backend.coachNotes.listAll())[id]).toBe('Omoplates serrées');
  });

  it('shows an error when coach notes fail to save', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const saveSpy = vi.spyOn(backend.coachNotes, 'save').mockRejectedValue(new Error('réseau'));
    const { user } = setup(`/exercises/${id}`, backend);
    const notes = await screen.findByRole('textbox', { name: /Remarques du coach/ });
    await user.type(notes, 'x');
    await user.tab();
    const alert = (await screen.findByText(/Remarques non enregistrées/)).closest('[role="alert"]');
    expect(alert).not.toBeNull();
    saveSpy.mockResolvedValue(undefined);
    await user.click(within(alert as HTMLElement).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Remarques enregistrées.')).toBeInTheDocument();
    expect(saveSpy).toHaveBeenLastCalledWith(id, 'x');
  });

  it('serialises coach note saves: only the latest request marks them saved', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const calls: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const real = backend.coachNotes.save.bind(backend.coachNotes);
    vi.spyOn(backend.coachNotes, 'save').mockImplementation(async (exId, notes) => {
      calls.push(`start:${notes}`);
      if (notes === 'a') await new Promise<void>((r) => { releaseFirst = r; });
      await real(exId, notes);
      calls.push(`end:${notes}`);
    });
    const { user } = setup(`/exercises/${id}`, backend);
    const notes = await screen.findByRole('textbox', { name: /Remarques du coach/ });
    await user.type(notes, 'a');
    await user.tab();
    await user.type(notes, 'b');
    await user.tab();
    await waitFor(() => { expect(calls).toEqual(['start:a']); });
    expect(screen.getByText('Enregistrement…')).toBeInTheDocument();
    releaseFirst();
    expect(await screen.findByText('Remarques enregistrées.')).toBeInTheDocument();
    expect(calls).toEqual(['start:a', 'end:a', 'start:ab', 'end:ab']);
    expect((await backend.coachNotes.listAll())[id]).toBe('ab');
  });

  it('still reports a coach note failure with a toast after leaving the page', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    let reject: (e: Error) => void = () => undefined;
    vi.spyOn(backend.coachNotes, 'save').mockImplementation(() => new Promise<void>((_, r) => { reject = r; }));
    const { user } = setup(`/exercises/${id}`, backend);
    const notes = await screen.findByRole('textbox', { name: /Remarques du coach/ });
    await user.type(notes, 'perdu ?');
    await user.click(screen.getByRole('link', { name: 'Retour aux exercices' }));
    await screen.findByRole('heading', { level: 1, name: 'Exercices' });
    reject(new Error('réseau'));
    expect(await screen.findByText(/Remarques du coach de « Développé couché » non enregistrées/)).toBeInTheDocument();
  });

  it('shows skeletons then a retry message when sessions or performances fail', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const sessions = vi.spyOn(backend.sessions, 'list').mockRejectedValue(new Error('réseau'));
    const perfs = vi.spyOn(backend.performances, 'list').mockRejectedValue(new Error('réseau'));
    const { user } = setup(`/exercises/${id}`, backend);
    await screen.findByRole('heading', { level: 1, name: 'Développé couché' });
    const perfAlert = (await screen.findByText(/Records indisponibles/)).closest('[role="alert"]') as HTMLElement;
    expect(screen.queryByText(/Aucun record/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Classique, par défaut\. Gérer/ })).toBeInTheDocument();
    const sessionAlert = (await screen.findByText(/Cycles indisponibles/)).closest('[role="alert"]') as HTMLElement;
    expect(screen.queryByText('Cycle A')).toBeNull();

    sessions.mockRestore();
    perfs.mockRestore();
    await user.click(within(sessionAlert).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Cycle A')).toBeInTheDocument();
    await user.click(within(perfAlert).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('button', { name: /^Classique, Par défaut · 1 record/ })).toBeInTheDocument();
  });

  it('list: hides cycle badges and offers a retry when sessions fail', async () => {
    const backend = createMockBackend(localStorage);
    const sessions = vi.spyOn(backend.sessions, 'list').mockRejectedValue(new Error('réseau'));
    const { user } = setup('/exercises', backend);
    const alert = (await screen.findByText(/Cycles indisponibles/)).closest('[role="alert"]') as HTMLElement;
    expect(screen.getByRole('link', { name: /Squat/ })).not.toHaveTextContent('Cycle');
    sessions.mockRestore();
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => { expect(screen.getByRole('link', { name: /Squat/ })).toHaveTextContent('Cycle A'); });
  });

  it('disables variant actions while an update is pending', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    let release: () => void = () => undefined;
    const real = backend.exercises.update.bind(backend.exercises);
    const updateSpy = vi.spyOn(backend.exercises, 'update').mockImplementation(async (exId, draft) => {
      await new Promise<void>((r) => { release = r; });
      return real(exId, draft);
    });
    const { user } = setup(`/exercises/${id}`, backend);
    const input = await screen.findByRole('textbox', { name: 'Nom de la nouvelle variante' });
    await user.type(input, 'Tempo{Enter}');
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Ajouter la variante' })).toBeDisabled(); });
    expect(screen.getByRole('button', { name: /^Pause,/ })).toBeDisabled();
    release();
    expect(await screen.findByRole('button', { name: /^Tempo,/ })).toBeEnabled();
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('adds a variant and refuses a duplicate name (D11)', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const { user } = setup(`/exercises/${id}`, backend);
    const input = await screen.findByRole('textbox', { name: 'Nom de la nouvelle variante' });
    await user.type(input, 'classique');
    await user.click(screen.getByRole('button', { name: 'Ajouter la variante' }));
    expect(screen.getByText('Une variante porte déjà ce nom.')).toHaveAttribute('role', 'alert');

    await user.clear(input);
    await user.type(input, 'Tempo 3-1-1');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: /^Tempo 3-1-1, Aucun record/ })).toBeInTheDocument();
    const saved = (await backend.exercises.list()).find((e) => e.id === id);
    expect(saved?.variants.map((v) => v.name)).toEqual(['Touch and Go', 'Pause', 'Tempo 3-1-1']);
    expect(saved?.variants.every((v) => v.id !== null)).toBe(true);
    expect(input).toHaveValue('');
  });

  it('protects the default variant', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const { user } = setup(`/exercises/${id}`, backend);
    await user.click(await screen.findByRole('button', { name: /^Classique,/ }));
    const dialog = screen.getByRole('dialog', { name: 'Classique' });
    expect(within(dialog).getByText(/n’est pas renommable : ses records.*« Touch and Go »/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Nom de la variante')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Supprimer la variante' })).toBeNull();
    expect(within(dialog).getByRole('link', { name: 'Voir le tableau des records' })).toHaveAttribute('href', `/records/${id}`);
  });

  it('renames a variant, refusing an existing name', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const { user } = setup(`/exercises/${id}`, backend);
    await user.click(await screen.findByRole('button', { name: /^Pause,/ }));
    const dialog = screen.getByRole('dialog', { name: 'Pause' });
    const field = within(dialog).getByLabelText('Nom de la variante');
    await user.clear(field);
    await user.type(field, 'Touch and go');
    await user.click(within(dialog).getByRole('button', { name: 'Renommer' }));
    expect(within(dialog).getByText('Une variante porte déjà ce nom.')).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'Pause 2 s');
    await user.click(within(dialog).getByRole('button', { name: 'Renommer' }));
    expect(await screen.findByRole('button', { name: /^Pause 2 s,/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const saved = (await backend.exercises.list()).find((e) => e.id === id);
    expect(saved?.variants.map((v) => v.name)).toEqual(['Touch and Go', 'Pause 2 s']);
  });

  it('deletes a variant after an honest confirmation, keeping performances', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const before = (await backend.performances.list()).length;
    const { user } = setup(`/exercises/${id}`, backend);
    await user.click(await screen.findByRole('button', { name: /^Pause,/ }));
    await user.click(screen.getByRole('button', { name: 'Supprimer la variante' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Supprimer « Pause » ?' });
    expect(confirm).toHaveAccessibleDescription(/ne sont pas effacés/);
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('dialog', { name: 'Pause' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Supprimer la variante' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Pause,/ })).toBeNull();
    });
    expect((await backend.performances.list()).length).toBe(before);
  });

  it('deletes the exercise after confirmation and returns to the list', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    const { user, router } = setup(`/exercises/${id}`, backend);
    await user.click(await screen.findByRole('button', { name: 'Supprimer l’exercice' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Supprimer « Développé couché » ?' });
    expect(confirm).toHaveAccessibleDescription(/ne sont pas effacées/);
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/exercises');
    });
    expect((await backend.exercises.list()).some((e) => e.id === id)).toBe(false);
  });

  it('shows a delete error inside the confirmation', async () => {
    const backend = createMockBackend(localStorage);
    const id = await benchId(backend);
    vi.spyOn(backend.exercises, 'remove').mockRejectedValue(new Error('Suppression refusée.'));
    const { user } = setup(`/exercises/${id}`, backend);
    await user.click(await screen.findByRole('button', { name: 'Supprimer l’exercice' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('Suppression refusée.')).toBeInTheDocument();
  });
});
