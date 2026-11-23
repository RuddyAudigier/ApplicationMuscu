import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/app/providers';
import { createMockBackend } from '@/data/mock';
import { OFFLINE_QUEUE_KEY } from '@/data/offlineQueue';
import { NetworkError, ValidationError, type DataBackend } from '@/data/ports';
import { startWorkout, type WorkoutState } from '@/domain/workout';
import { WorkoutScreen, loadActiveWorkout, loadLastReport, saveActiveWorkout } from '@/features/workout';

const SESSION = 'Séance test (mock)';

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
  render(
    <Providers backend={backend}>
      <RouterProvider router={router} />
    </Providers>,
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

describe('WorkoutScreen', () => {
  it('redirige vers l’accueil sans séance en cours', async () => {
    renderWorkout(makeBackend());
    expect(await screen.findByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
  });

  it('affiche en-tête, nom, remarques coach, variantes et série 1', async () => {
    const backend = makeBackend();
    await seedWorkout(backend);
    renderWorkout(backend);
    await ready();
    expect(screen.getByText(SESSION)).toBeInTheDocument();
    expect(screen.getByText(/exercice 1 sur 2/)).toBeInTheDocument();
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
    expect(within(dialog).getByRole('button', { name: /^5 reps : vide/ })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^6 reps : 92,5 kg/ }));
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
    await user.click(within(dialog).getByRole('button', { name: /^8 reps : vide/ }));
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
    expect(screen.getByText(/exercice 2 sur 2/)).toBeInTheDocument();
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
    expect(screen.getByText(/exercice 3 sur 3/)).toBeInTheDocument();
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
});
