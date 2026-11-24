import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackendProvider } from '@/data/queries';
import { UiProvider } from '@/ui';
import { createMockBackend } from '@/data/mock';
import type { DataBackend } from '@/data/ports';
import { todayIso } from '@/domain/dates';
import { ProgramScreen } from '@/features/program';
import { loadActiveWorkout, loadLastReport, saveActiveWorkout, saveLastReport } from '@/features/workout';

const SEED = 'Séance test (mock)';
/** Nom accessible = texte visible du bouton (WCAG 2.5.3) : il commence par l'action et le titre. */
const startName = (verb: string, title: string) => new RegExp(`^${verb} ${title.replace(/[()]/g, '\\$&')}`);

const daysAgo = (n: number) => todayIso(new Date(Date.now() - n * 86_400_000));

const activeOf = (sessionId: string, sessionName: string) => ({
  version: 2 as const, sessionId, sessionName, cycle: 'A' as const, date: todayIso(),
  startedAt: new Date().toISOString(), form: null, mood: '', warmup: [], exercises: [],
});

function setup(backend: DataBackend = createMockBackend(localStorage)) {
  const router = createMemoryRouter(
    [
      { path: '/program', element: <ProgramScreen /> },
      { path: '/workout', element: <h1>Séance en cours</h1> },
    ],
    { initialEntries: ['/program'] },
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

const seedRow = () => screen.findByRole('button', { name: startName('Démarrer', `Cycle A : ${SEED}`) });

describe('ProgramScreen', () => {
  it('affiche les onglets A/B, la durée et les séances du cycle en cours', async () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Programme' })).toBeInTheDocument();
    const tabA = await screen.findByRole('tab', { name: /A En cours/ });
    expect(tabA).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /B dans 14 j/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('radio', { name: '2 sem.' })).toHaveAttribute('aria-checked', 'true');
    const row = await seedRow();
    expect(within(row).getByText('Développé couché')).toBeInTheDocument();
    expect(within(row).getAllByText('2–3 séries')).toHaveLength(2);
  });

  it('prolonge le cycle en cours à 3 semaines puis revient au standard', async () => {
    const { backend, user } = setup();
    await seedRow();
    await user.click(screen.getByRole('radio', { name: '3 sem.' }));
    await waitFor(async () => {
      expect(await backend.cycles.get()).toEqual({ current: 'A', startedOn: todayIso(), weeks: 3 });
    });
    expect(await screen.findByText(/B commence dans 21 jours/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /B dans 21 j/ })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '2 sem.' }));
    await waitFor(async () => {
      expect((await backend.cycles.get())?.weeks).toBe(2);
    });
  });

  it("l'onglet B n'a pas de réglage de durée et liste ses séances (vide)", async () => {
    const { user } = setup();
    await seedRow();
    await user.click(screen.getByRole('tab', { name: /^B/ }));
    expect(screen.queryByRole('radiogroup', { name: /Durée/ })).toBeNull();
    expect(screen.getByText(/Seul le cycle en cours peut être prolongé/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aucune séance dans le cycle B' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /^A/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('démarre une séance : état persisté puis navigation vers /workout', async () => {
    saveLastReport({ exercises: [] } as never);
    const { user } = setup();
    await user.click(await seedRow());
    await user.click(await screen.findByRole('button', { name: 'Frais' }));
    expect(await screen.findByRole('heading', { name: 'Séance en cours' })).toBeInTheDocument();
    const state = loadActiveWorkout();
    expect(state?.sessionName).toBe(SEED);
    expect(state?.exercises.map((e) => e.plannedSeries)).toEqual([3, 3]);
    expect(loadLastReport()).toBeNull();
  });

  it('empêche le démarrage tant que les exercices ne sont pas chargés', async () => {
    const backend = createMockBackend(localStorage);
    backend.exercises.list = () => Promise.reject(new Error('réseau'));
    const { user } = setup(backend);
    expect(await screen.findByText(/Impossible de charger les exercices/)).toBeInTheDocument();
    const row = await seedRow();
    expect(row).toBeDisabled();
    await user.click(row);
    expect(loadActiveWorkout()).toBeNull();
    expect(screen.getByRole('button', { name: 'Recharger les exercices' })).toBeInTheDocument();
  });

  it('demande confirmation pour revenir à 2 semaines en 3e semaine', async () => {
    const backend = createMockBackend(localStorage);
    await backend.cycles.save({ current: 'A', startedOn: daysAgo(15), weeks: 3 });
    const { user } = setup(backend);
    expect(await screen.findByText(/Revenir à 2 semaines fait basculer vers B maintenant/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '2 sem.' }));
    let dialog = screen.getByRole('alertdialog', { name: 'Revenir à 2 semaines ?' });
    expect(within(dialog).getByText(/Revenir à 2 semaines fait basculer vers B maintenant/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect((await backend.cycles.get())?.weeks).toBe(3);
    await user.click(screen.getByRole('radio', { name: '2 sem.' }));
    dialog = screen.getByRole('alertdialog', { name: 'Revenir à 2 semaines ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Basculer vers B' }));
    expect(await screen.findByRole('tab', { name: /B En cours/ })).toBeInTheDocument();
    expect((await backend.cycles.get())?.weeks).toBe(2);
  });

  it('demande confirmation avant d’abandonner une autre séance en cours', async () => {
    saveActiveWorkout({
      version: 2, sessionId: 'other', sessionName: 'Autre', cycle: 'B', date: todayIso(),
      startedAt: new Date().toISOString(), form: null, mood: '', warmup: [], exercises: [],
    });
    const { user } = setup();
    await user.click(await seedRow());
    const dialog = screen.getByRole('alertdialog', { name: 'Abandonner la séance en cours ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(loadActiveWorkout()?.sessionId).toBe('other');
    await user.click(await seedRow());
    await user.click(screen.getByRole('button', { name: 'Abandonner et démarrer' }));
    await user.click(await screen.findByRole('button', { name: 'Frais' }));
    expect(await screen.findByRole('heading', { name: 'Séance en cours' })).toBeInTheDocument();
    expect(loadActiveWorkout()?.sessionName).toBe(SEED);
  });

  it('reprend sans confirmation la séance déjà en cours', async () => {
    const backend = createMockBackend(localStorage);
    const [session] = await backend.sessions.list();
    saveActiveWorkout({
      version: 2, sessionId: session?.id ?? '', sessionName: SEED, cycle: 'A', date: todayIso(),
      startedAt: new Date().toISOString(), form: null, mood: '', warmup: [], exercises: [],
    });
    const { user } = setup(backend);
    const row = await screen.findByRole('button', { name: startName('Reprendre', `Cycle A : ${SEED}`) });
    expect(within(row).getByText('En cours')).toBeInTheDocument();
    await user.click(row);
    expect(await screen.findByRole('heading', { name: 'Séance en cours' })).toBeInTheDocument();
    expect(loadActiveWorkout()?.exercises).toEqual([]);
  });

  it('crée une séance dans le cycle B avec le constructeur', async () => {
    const { backend, user } = setup();
    await seedRow();
    await user.click(screen.getByRole('button', { name: 'Ajouter une séance' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle séance' });
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByText('Donne un nom à la séance.')).toBeInTheDocument();
    expect(within(dialog).getByText('Ajoute au moins un exercice.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Nom de la séance'), 'Bas du corps');
    await user.click(within(dialog).getByRole('radio', { name: 'Cycle B' }));
    await user.type(within(dialog).getByLabelText('Rechercher un exercice'), 'quadri');
    await user.click(await within(dialog).findByRole('button', { name: /Squat/, pressed: false }));
    await user.clear(within(dialog).getByLabelText('Rechercher un exercice'));
    await user.click(within(dialog).getByRole('button', { name: /Développé couché/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Monter Développé couché' }));
    const series = within(dialog).getByRole('radiogroup', { name: 'Séries prévues pour Squat' });
    await user.click(within(series).getByRole('radio', { name: '5' }));
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    const created = (await backend.sessions.list()).find((s) => s.name === 'Bas du corps');
    expect(created?.cycle).toBe('B');
    expect(created?.exercises.map((e) => [e.name, e.series])).toEqual([['Développé couché', 3], ['Squat', 5]]);
    expect(screen.queryByText(/porte déjà ce nom/)).toBeNull();
    await user.click(screen.getByRole('tab', { name: /^B/ }));
    expect(await screen.findByRole('button', { name: startName('Démarrer', 'Cycle B : Bas du corps') })).toBeInTheDocument();
  });

  it('refuse un nom déjà pris dans le même cycle', async () => {
    const { backend, user } = setup();
    await seedRow();
    await user.click(screen.getByRole('button', { name: 'Ajouter une séance' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle séance' });
    await user.type(within(dialog).getByLabelText('Nom de la séance'), '  séance TEST (mock) ');
    await user.click(within(dialog).getByRole('button', { name: /Squat/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByText('Une séance du cycle A porte déjà ce nom.')).toBeInTheDocument();
    expect(await backend.sessions.list()).toHaveLength(1);
    await user.click(within(dialog).getByRole('radio', { name: 'Cycle B' }));
    expect(within(dialog).queryByText(/porte déjà ce nom/)).toBeNull();
  });

  it('supprime la séance en cours en l’abandonnant', async () => {
    const backend = createMockBackend(localStorage);
    const [session] = await backend.sessions.list();
    saveActiveWorkout(activeOf(session?.id ?? '', SEED));
    const { user } = setup(backend);
    await user.click(await screen.findByRole('button', { name: `Modifier Cycle A : ${SEED}` }));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Supprimer la séance ?' });
    expect(within(confirm).getByText(/Cette séance est en cours/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => { expect(loadActiveWorkout()).toBeNull(); });
  });

  it('modifie puis supprime une séance après confirmation', async () => {
    const { backend, user } = setup();
    await seedRow();
    await user.click(screen.getByRole('button', { name: `Modifier Cycle A : ${SEED}` }));
    const dialog = screen.getByRole('dialog', { name: 'Modifier la séance' });
    const nameInput = within(dialog).getByLabelText('Nom de la séance');
    expect(nameInput).toHaveValue(SEED);
    expect(within(dialog).queryByText(/seront renommées aussi/)).toBeNull();
    await user.type(nameInput, ' bis');
    expect(within(dialog).getByText(/seront renommées aussi/)).toBeInTheDocument();
    await user.clear(nameInput);
    await user.type(nameInput, SEED);
    await user.click(within(dialog).getByRole('button', { name: 'Retirer Squat' }));
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect((await backend.sessions.list())[0]?.exercises).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: `Modifier Cycle A : ${SEED}` }));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Supprimer la séance ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('heading', { name: 'Aucune séance dans le cycle A' })).toBeInTheDocument();
    expect(await backend.sessions.list()).toEqual([]);
  });

  it('range à part les séances sans cycle', async () => {
    const backend = createMockBackend(localStorage);
    const exercises = await backend.exercises.list();
    await backend.sessions.create({ name: 'Ancienne', cycle: null, exercises: [{ exerciseId: exercises[0]?.id ?? '', series: 1 }] });
    setup(backend);
    expect(await screen.findByRole('heading', { name: 'Sans cycle' })).toBeInTheDocument();
    const row = screen.getByRole('button', { name: startName('Démarrer', 'Ancienne') });
    expect(within(row).getByText('1 série')).toBeInTheDocument();
  });

  it('signale un échec d’enregistrement de la durée', async () => {
    const backend = createMockBackend(localStorage);
    backend.cycles.save = () => Promise.reject(new Error('réseau'));
    const { user } = setup(backend);
    await seedRow();
    await user.click(screen.getByRole('radio', { name: '3 sem.' }));
    expect(await screen.findByText('La durée du cycle n’a pas pu être enregistrée. Réessaie.')).toBeInTheDocument();
  });

  it('cycle en cours de chargement : squelette, durée désactivée, pas de cycle par défaut', async () => {
    const backend = createMockBackend(localStorage);
    await backend.cycles.save({ current: 'B', startedOn: todayIso(), weeks: 3 });
    let release: () => void = () => undefined;
    const get = backend.cycles.get.bind(backend.cycles);
    backend.cycles.get = () => new Promise((resolve) => { release = () => { resolve(get()); }; });
    setup(backend);
    expect(screen.getByText('Chargement du cycle…')).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    expect(screen.queryByRole('tab', { name: /En cours/ })).toBeNull();
    expect(screen.queryByRole('button', { name: startName('Démarrer', `Cycle A : ${SEED}`) })).toBeNull();
    release();
    expect(await screen.findByRole('tab', { name: /B En cours/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radio', { name: '3 sem.' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '3 sem.' })).toBeEnabled();
  });

  it('cycle illisible : erreur avec Réessayer, jamais le cycle par défaut', async () => {
    const backend = createMockBackend(localStorage);
    const get = backend.cycles.get.bind(backend.cycles);
    let fail = true;
    backend.cycles.get = () => (fail ? Promise.reject(new Error('réseau')) : get());
    const { user } = setup(backend);
    expect(await screen.findByText(/Impossible de charger ton cycle A\/B/)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /Durée/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /En cours/ })).toBeNull();
    expect(screen.queryByRole('button', { name: startName('Démarrer', `Cycle A : ${SEED}`) })).toBeNull();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('tab', { name: /A En cours/ })).toBeInTheDocument();
    expect(await seedRow()).toBeEnabled();
  });

  it('affiche une erreur de chargement avec Réessayer', async () => {
    const backend = createMockBackend(localStorage);
    backend.sessions.list = () => Promise.reject(new Error('réseau'));
    setup(backend);
    expect(await screen.findByText('Impossible de charger les séances.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});
