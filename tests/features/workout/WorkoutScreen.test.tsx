import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockBackend } from '@/data/mock';
import { OFFLINE_QUEUE_KEY } from '@/data/offlineQueue';
import { NetworkError, ValidationError, type DataBackend } from '@/data/ports';
import { BackendProvider } from '@/data/queries';
import { todayIso } from '@/domain/dates';
import type { Report } from '@/domain/report';
import { startWorkout, type WorkoutState } from '@/domain/workout';
import {
  WorkoutScreen,
  loadActiveWorkout,
  loadLastReport,
  saveActiveWorkout,
  saveLastReport,
} from '@/features/workout';
import { UiProvider } from '@/ui';

const SESSION = 'Séance test (mock)';

/** Compteur d'appels à buildReport (implémentation réelle conservée). */
const reportCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('@/domain/report', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/report')>();
  return {
    ...actual,
    buildReport: (...args: Parameters<typeof actual.buildReport>) => {
      reportCalls.n += 1;
      return actual.buildReport(...args);
    },
  };
});

/** `Storage.prototype.setItem` d'origine, capturé avant l'espion. */
function realSetItem(): (this: Storage, key: string, value: string) => void {
  return Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')?.value as (
    this: Storage,
    key: string,
    value: string,
  ) => void;
}

function makeBackend(): DataBackend {
  let n = 0;
  return createMockBackend(localStorage, {
    genId: (prefix) => {
      n += 1;
      return `${prefix}-${String(n)}`;
    },
  });
}

async function seedWorkout(backend: DataBackend, coachNotes = 'Coudes ouverts. Rack à 8.'): Promise<WorkoutState> {
  const exercises = await backend.exercises.list();
  const bench = exercises.find((e) => e.name === 'Développé couché');
  if (bench && coachNotes) await backend.coachNotes.save(bench.id, coachNotes);
  const [session] = await backend.sessions.list();
  if (!session) throw new Error('seed');
  const state = startWorkout(session, exercises, new Date());
  saveActiveWorkout(state);
  return state;
}

function renderWorkout(backend: DataBackend) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Accueil</h1> },
      { path: '/program', element: <h1>Programme</h1> },
      { path: '/report', element: <h1>Compte rendu</h1> },
      { path: '/workout', element: <WorkoutScreen /> },
    ],
    { initialEntries: ['/workout'] },
  );
  // Pas de nouvelle tentative automatique : les erreurs de requête sont visibles tout de suite.
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
  return router;
}

async function ready(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeEnabled();
  });
}

async function doSerie(user: ReturnType<typeof userEvent.setup>, reps: string, kg: string): Promise<void> {
  const repsInput = screen.getByLabelText('Reps');
  const kgInput = screen.getByLabelText('Poids (kg)');
  await user.clear(repsInput);
  await user.type(repsInput, reps);
  await user.clear(kgInput);
  await user.type(kgInput, kg);
  await user.click(screen.getByRole('button', { name: 'Valider la série' }));
}

// Parcours utilisateur longs (plusieurs séries saisies) : marge contre la charge machine.
describe('WorkoutScreen', { timeout: 20_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirige vers l’accueil sans séance en cours', async () => {
    renderWorkout(makeBackend());
    expect(await screen.findByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
  });

  it('affiche en-tête, nom, remarques coach, variantes et série 1', async () => {
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    expect(await screen.findByText('A1')).toBeInTheDocument();
    expect(screen.getByText('Exercice 1 sur 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Développé couché' })).toBeInTheDocument();
    expect(await screen.findByText(/Coudes ouverts/)).toBeInTheDocument();
    const variants = screen.getByRole('radiogroup', { name: 'Variante' });
    expect(within(variants).getByRole('radio', { name: 'Classique' })).toHaveAttribute('aria-checked', 'true');
    expect(within(variants).getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('heading', { name: 'Série 1' })).toBeInTheDocument();
    expect(screen.getByText('Pas encore de cible · ouvre « Mes records »')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider la série' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Fatigué/ })).toBeNull();
  });

  it('« Mes records » : choisir une ligne fixe la cible et pré-remplit reps/kg', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Mes records' }));
    const dialog = screen.getByRole('dialog', { name: 'Mes records' });
    const pills = within(dialog).getByRole('radiogroup', { name: 'Variante du tableau' });
    expect(within(pills).getByRole('radio', { name: 'Classique' })).toHaveAttribute('aria-checked', 'true');
    // 30 lignes ; 5 × 90 est dominé par 6 × 92,5 (Pareto).
    const rows = within(dialog).getAllByRole('button', { name: /reps? :/ });
    expect(rows).toHaveLength(30);
    expect(within(dialog).getByRole('button', { name: /^5 reps : à conquérir/ })).toBeInTheDocument();
    const six = within(dialog).getByRole('button', { name: /^6 reps : 92,5 kg, RPE 9,5/ });
    expect(within(six).getByText('9,5')).toBeInTheDocument();
    expect(within(within(dialog).getByRole('button', { name: /^5 reps/ })).getByText('à conquérir')).toBeInTheDocument();
    await user.click(six);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Cible : battre 6 × 92,5 kg')).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toHaveValue('6');
    expect(screen.getByLabelText('Poids (kg)')).toHaveValue('92.5');
    expect(loadActiveWorkout()?.exercises[0]?.series[0]?.target).toEqual({ reps: 6, weight: 92.5 });
  });

  it('cible sur une autre variante (ligne vide) : la série passe sur cette variante', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Mes records' }));
    const dialog = screen.getByRole('dialog', { name: 'Mes records' });
    await user.click(within(dialog).getByRole('radio', { name: 'Pause' }));
    expect(within(dialog).getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(dialog).getByRole('button', { name: /^8 reps : à conquérir/ }));
    expect(screen.getByText('Cible : premier record à 8 reps')).toBeInTheDocument();
    const variants = screen.getByRole('radiogroup', { name: 'Variante' });
    expect(within(variants).getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'true');
    // Fermeture sans choix.
    await user.click(screen.getByRole('button', { name: 'Mes records' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^8 reps/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('changer de variante efface la cible', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Mes records' }));
    await user.click(screen.getByRole('button', { name: /^6 reps : 92,5 kg/ }));
    const variants = screen.getByRole('radiogroup', { name: 'Variante' });
    await user.click(within(variants).getByRole('radio', { name: 'Pause' }));
    expect(within(variants).getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Pas encore de cible · ouvre « Mes records »')).toBeInTheDocument();
    await user.click(within(variants).getByRole('radio', { name: 'Pause' }));
    expect(loadActiveWorkout()?.exercises[0]?.series[0]?.variantKey).toBe('variant-4');
  });

  it('valide une série : badge PR en direct, RPE choisi, sauvegarde', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(within(screen.getByRole('radiogroup', { name: 'RPE' })).getByRole('radio', { name: '8' }));
    await doSerie(user, '7', '92,5');
    const done = screen.getByRole('list', { name: 'Séries faites' });
    expect(within(done).getByText('S1')).toBeInTheDocument();
    expect(within(done).getByText(/kg · RPE 8/)).toBeInTheDocument();
    expect(within(done).getByText('PR')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Série 2' })).toBeInTheDocument();
    const saved = loadActiveWorkout()?.exercises[0]?.series[0];
    expect(saved?.validated).toBe(true);
    expect(saved?.rpe).toBe(8);
    // Même perf ensuite : déjà faite dans la séance, pas de second PR.
    await doSerie(user, '7', '92,5');
    expect(within(screen.getByRole('list', { name: 'Séries faites' })).getAllByText('PR')).toHaveLength(1);
    // En dessous de l'historique : pas de PR.
    await doSerie(user, '6', '80');
    expect(within(screen.getByRole('list', { name: 'Séries faites' })).getAllByText('PR')).toHaveLength(1);
    expect(screen.getByText(/Exercice terminé · 3 séries/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajouter une série' }));
    expect(screen.getByRole('heading', { name: 'Série 4' })).toBeInTheDocument();
  });

  it('« Fatigué ? Arrêter à N séries » termine l’exercice et passe au suivant', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Squat' })).toBeInTheDocument();
    expect(screen.getByText('Exercice 2 sur 2')).toBeInTheDocument();
    const bench = loadActiveWorkout()?.exercises[0];
    expect(bench?.stoppedEarly).toBe(true);
    expect(bench?.series).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '‹ Exercice précédent' }));
    expect(screen.getByText(/Exercice terminé · 1 série · fatigué/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exercice suivant ›' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Squat' })).toBeInTheDocument();
  });

  it('ajoute un exercice bonus', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Exercice suivant ›' }));
    await user.click(screen.getByRole('button', { name: 'Exercice bonus' }));
    const dialog = screen.getByRole('dialog', { name: 'Exercice bonus' });
    await user.type(within(dialog).getByLabelText('Rechercher un exercice'), 'zzz');
    expect(within(dialog).getByText('Aucun exercice trouvé.')).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Rechercher un exercice'));
    await user.type(within(dialog).getByLabelText('Rechercher un exercice'), 'deve');
    await user.click(within(dialog).getByRole('button', { name: /Développé couché/ }));
    expect(screen.getByText('Exercice 3 sur 3')).toBeInTheDocument();
    expect(loadActiveWorkout()?.exercises).toHaveLength(3);
  });

  it('retour au programme garde la séance', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Retour au programme' }));
    expect(await screen.findByRole('heading', { name: 'Programme' })).toBeInTheDocument();
    expect(loadActiveWorkout()).not.toBeNull();
  });

  it('Terminer : enregistre, efface la séance, sauvegarde le compte rendu et ouvre /report', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '7', '92,5');
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Terminer la séance ?' });
    expect(within(confirm).getByText(/5 séries non validées ne seront pas enregistrées/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Terminer' }));
    expect(await screen.findByRole('heading', { name: 'Compte rendu' })).toBeInTheDocument();
    expect(loadActiveWorkout()).toBeNull();
    const report = loadLastReport();
    expect(report?.prCount).toBe(1);
    expect(report?.seriesCount).toBe(1);
    const perfs = await backend.performances.list();
    expect(perfs).toHaveLength(6);
  });

  it('Terminer annulé : rien n’est enregistré', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '7', '92,5');
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Développé couché' })).toBeInTheDocument();
    expect(loadActiveWorkout()).not.toBeNull();
    expect(await backend.performances.list()).toHaveLength(5);
  });

  it('Terminer hors-ligne : file locale + toast honnête, puis compte rendu', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    backend.performances.add = () => Promise.reject(new NetworkError('offline'));
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    await doSerie(user, '5', '100');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(await screen.findByRole('heading', { name: 'Compte rendu' })).toBeInTheDocument();
    expect(await screen.findByText(/Connexion instable…/)).toBeInTheDocument();
    expect(loadActiveWorkout()).toBeNull();
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toContain('Développé couché');
  });

  it('Terminer en erreur : la séance est conservée et un toast d’erreur s’affiche', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const backend = makeBackend();
    backend.performances.add = () => Promise.reject(new ValidationError('refusé'));
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    await doSerie(user, '5', '100');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    const alert = await screen.findByText(/Enregistrement impossible/);
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Squat' })).toBeInTheDocument();
    expect(loadActiveWorkout()?.exercises[1]?.series[0]?.validated).toBe(true);
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeEnabled();
    expect(loadLastReport()).toBeNull();
  });

  it('Terminer sans série validée : quitter sans rien enregistrer', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend, '');
    renderWorkout(backend);
    await ready();
    expect(screen.queryByText(/Coach :/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Quitter la séance ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(loadActiveWorkout()).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Quitter' }));
    expect(await screen.findByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
    expect(loadActiveWorkout()).toBeNull();
    expect(await backend.performances.list()).toHaveLength(5);
  });

  it('séance sans exercice : propose d’en ajouter un', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    const state = await seedWorkout(backend);
    saveActiveWorkout({ ...state, exercises: [] });
    renderWorkout(backend);
    await ready();
    expect(screen.getByText('Aucun exercice dans cette séance.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Squat/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Squat' })).toBeInTheDocument();
  });

  it('« Mes records » : une pastille change la variante de la série et efface la cible', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Mes records' }));
    await user.click(screen.getByRole('button', { name: /^6 reps : 92,5 kg/ }));
    expect(screen.getByText('Cible : battre 6 × 92,5 kg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes records' }));
    const dialog = screen.getByRole('dialog', { name: 'Mes records' });
    await user.click(within(dialog).getByRole('radio', { name: 'Pause' }));
    expect(within(dialog).getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('button', { name: /^6 reps : à conquérir/ })).toHaveAttribute('aria-pressed', 'false');
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    const variants = screen.getByRole('radiogroup', { name: 'Variante' });
    expect(within(variants).getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Pas encore de cible · ouvre « Mes records »')).toBeInTheDocument();
    const serie = loadActiveWorkout()?.exercises[0]?.series[0];
    expect(serie?.variantKey).toBe('variant-4');
    expect(serie?.target).toBeNull();
  });

  it('données non chargées : Terminer bloqué, message et Réessayer', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    const list = backend.performances.list.bind(backend.performances);
    let fail = true;
    backend.performances.list = () => (fail ? Promise.reject(new NetworkError('offline')) : list());
    await seedWorkout(backend);
    renderWorkout(backend);
    const alert = await screen.findByText(/Impossible de charger tes exercices ou ton historique/);
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeDisabled();
    // La saisie reste possible.
    await doSerie(user, '7', '92,5');
    expect(screen.getByRole('heading', { name: 'Série 2' })).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await ready();
    expect(alert).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Séries faites' })).getByText('PR')).toBeInTheDocument();
  });

  it('badge PR en direct = compte rendu (ordre réel de validation)', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    const state = await seedWorkout(backend);
    const now = Date.now();
    const at = (minAgo: number): string => new Date(now - minAgo * 60_000).toISOString();
    const bench = state.exercises[0];
    if (!bench) throw new Error('seed');
    const [s0, s1, s2] = bench.series;
    if (!s0 || !s1 || !s2) throw new Error('seed');
    // Historique : 5×90, 6×90, 6×92,5. S1 = 6×100 validée en second, S2 = 8×100 validée en premier :
    // 8×100 domine 6×100, donc seule S2 est un PR (en direct comme dans le compte rendu).
    saveActiveWorkout({
      ...state,
      startedAt: at(10),
      exercises: [
        {
          ...bench,
          series: [
            { ...s0, reps: '6', kg: '100', validated: true, validatedAt: at(2) },
            { ...s1, reps: '8', kg: '100', validated: true, validatedAt: at(5) },
            s2,
          ],
        },
        ...state.exercises.slice(1),
      ],
    });
    renderWorkout(backend);
    await ready();
    const rows = within(screen.getByRole('list', { name: 'Séries faites' })).getAllByRole('listitem');
    expect(rows[0]).not.toHaveTextContent('PR');
    expect(rows[1]).toHaveTextContent('PR');
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Terminer' }));
    await screen.findByRole('heading', { name: 'Compte rendu' });
    const series = loadLastReport()?.exercises[0]?.series;
    expect(series?.map((x) => [x.n, x.isPr])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it('sauvegarde de la séance impossible : un seul toast d’erreur', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    const setItem = realSetItem();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'workout_state_v2') throw new Error('QuotaExceededError');
      setItem.call(this, key, value);
    });
    renderWorkout(backend);
    await ready();
    expect(await screen.findByText(/Impossible de sauvegarder la séance sur cet appareil…/)).toBeInTheDocument();
    await doSerie(user, '7', '92,5');
    expect(screen.getAllByText(/Impossible de sauvegarder la séance/)).toHaveLength(1);
  });

  it('écriture de la file hors-ligne impossible : séance gardée, ancien compte rendu restauré', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const backend = makeBackend();
    backend.performances.add = () => Promise.reject(new NetworkError('offline'));
    await seedWorkout(backend);
    const previous = { title: 'Ancienne', exercises: [] } as unknown as Report;
    saveLastReport(previous);
    const setItem = realSetItem();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith(OFFLINE_QUEUE_KEY)) throw new Error('QuotaExceededError');
      setItem.call(this, key, value);
    });
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    await doSerie(user, '5', '100');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(await screen.findByText(/Enregistrement impossible/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Compte rendu' })).toBeNull();
    expect(loadActiveWorkout()?.exercises[1]?.series[0]?.validated).toBe(true);
    expect(loadLastReport()).toEqual(previous);
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });

  it('badges PR : buildReport n’est pas rappelé quand seule la saisie non validée change', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    const before = reportCalls.n;
    await user.type(screen.getByLabelText('Reps'), '5');
    await user.type(screen.getByLabelText('Poids (kg)'), '80');
    await user.click(within(screen.getByRole('radiogroup', { name: 'RPE' })).getByRole('radio', { name: '7' }));
    expect(reportCalls.n).toBe(before);
    await user.click(screen.getByRole('button', { name: 'Valider la série' }));
    expect(reportCalls.n).toBeGreaterThan(before);
  });

  it('dernière série validée : le focus va sur l’exercice suivant, sinon sur « Ajouter une série »', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    await doSerie(user, '5', '80');
    await doSerie(user, '5', '80');
    expect(screen.getByRole('button', { name: 'Exercice suivant ›' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Exercice suivant ›' }));
    await doSerie(user, '5', '100');
    await doSerie(user, '5', '100');
    await doSerie(user, '5', '100');
    expect(screen.getByRole('button', { name: 'Ajouter une série' })).toHaveFocus();
  });

  it('après « Valider la série », le focus revient sur les reps', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    expect(screen.getByLabelText('Reps')).toHaveFocus();
  });

  it('en-tête : code de séance (A1) ou nom de la séance sans cycle', async () => {
    const backend = makeBackend();
    const state = await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    const header = screen.getByRole('banner');
    expect(await within(header).findByText('A1')).toBeInTheDocument();
    expect(header).toHaveTextContent('A1 · Exercice 1 sur 2');
    expect(within(header).queryByText(SESSION)).toBeNull();
    cleanup();
    saveActiveWorkout({ ...state, cycle: null });
    renderWorkout(backend);
    await ready();
    expect(screen.getByRole('banner')).toHaveTextContent(`${SESSION} · Exercice 1 sur 2`);
  });

  it('exercices en chargement : pas de variante devinée, « Mes records » désactivé', async () => {
    const backend = makeBackend();
    await seedWorkout(backend);
    backend.exercises.list = () => new Promise(() => undefined);
    renderWorkout(backend);
    expect(screen.getByText('Chargement des variantes…')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Classique' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mes records' })).toBeDisabled();
  });

  it('exercice inconnu : aucune variante, « Mes records » désactivé', async () => {
    const backend = makeBackend();
    const state = await seedWorkout(backend);
    const [bench] = state.exercises;
    if (!bench) throw new Error('seed');
    saveActiveWorkout({ ...state, exercises: [{ ...bench, exerciseId: 'inconnu' }] });
    renderWorkout(backend);
    await ready();
    expect(screen.getByText(/Exercice introuvable dans ta bibliothèque/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Classique' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mes records' })).toBeDisabled();
  });

  it('« Modifier » une série faite la rouvre avec ses valeurs', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    expect(screen.getByRole('heading', { name: 'Série 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifier la série 1' }));
    expect(screen.getByRole('heading', { name: 'Série 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toHaveValue('5');
    expect(screen.queryByRole('list', { name: 'Séries faites' })).toBeNull();
    expect(loadActiveWorkout()?.exercises[0]?.series[0]?.validated).toBe(false);
  });

  it('supprime une série à faire', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Supprimer la série 1' }));
    expect(loadActiveWorkout()?.exercises[0]?.series).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Supprimer la série 1' }));
    expect(loadActiveWorkout()?.exercises[0]?.series).toHaveLength(1);
    // La dernière série ne se supprime pas : on retire l'exercice.
    expect(screen.queryByRole('button', { name: /Supprimer la série/ })).toBeNull();
  });

  it('retire l’exercice après confirmation', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirer Développé couché' }));
    let confirm = await screen.findByRole('alertdialog', { name: 'Retirer l’exercice ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(loadActiveWorkout()?.exercises).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirer Développé couché' }));
    confirm = await screen.findByRole('alertdialog', { name: 'Retirer l’exercice ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Retirer' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Squat' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Exercice 1 sur 1');
    expect(loadActiveWorkout()?.exercises.map((e) => e.name)).toEqual(['Squat']);
  });

  it('date de la séance : aujourd’hui par défaut, modifiable dans le passé seulement', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
    const input = within(screen.getByRole('dialog')).getByLabelText('Date de la séance');
    const today = todayIso();
    expect(input).toHaveValue(today);
    expect(input).toHaveAttribute('max', today);
    fireEvent.change(input, { target: { value: '2099-01-01' } });
    expect(loadActiveWorkout()?.date).toBe(today);
    fireEvent.change(input, { target: { value: '2026-03-02' } });
    expect(loadActiveWorkout()?.date).toBe('2026-03-02');
  });

  it('abandonne la séance après confirmation', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abandonner la séance' }));
    let confirm = await screen.findByRole('alertdialog', { name: 'Abandonner la séance ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }));
    expect(loadActiveWorkout()).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abandonner la séance' }));
    confirm = await screen.findByRole('alertdialog', { name: 'Abandonner la séance ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Abandonner' }));
    expect(await screen.findByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
    expect(loadActiveWorkout()).toBeNull();
    expect(await backend.performances.list()).toHaveLength(5);
  });

  it('« Mes records » : le nom accessible contient le texte visible « auj. »', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    const state = await seedWorkout(backend);
    const benchId = state.exercises[0]?.exerciseId ?? '';
    const bench = (await backend.exercises.list()).find((e) => e.id === benchId);
    const variant = bench?.variants[0];
    await backend.performances.add([{
      exerciseId: benchId, exerciseName: 'Développé couché', sessionName: SESSION, reps: 12, weight: 70, rpe: 9,
      variantId: variant?.id ?? null, variantName: variant?.name ?? '', serieNumber: 1, performanceDate: todayIso(),
    }]);
    renderWorkout(backend);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Mes records' }));
    const row = await within(screen.getByRole('dialog')).findByRole('button', { name: /^12 reps : 70 kg, RPE 9, auj\.$/ });
    expect(within(row).getByText('auj.')).toBeInTheDocument();
  });

  it('« Fatigué » avec une série saisie non validée : confirmation', async () => {
    const user = userEvent.setup();
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    await doSerie(user, '5', '80');
    await user.type(screen.getByLabelText('Reps'), '4');
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Arrêter l’exercice ?' });
    expect(dialog).toHaveTextContent('La série 2 est saisie mais pas validée');
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { name: 'Série 2' })).toBeInTheDocument();
    expect(loadActiveWorkout()?.exercises[0]?.stoppedEarly).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Arrêter' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Squat' })).toBeInTheDocument();
    expect(loadActiveWorkout()?.exercises[0]?.series).toHaveLength(1);
  });
});
