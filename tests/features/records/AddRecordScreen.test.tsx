import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockBackend } from '../../../src/data/mock';
import { NetworkError } from '../../../src/data/ports';
import { benchPerf, exerciseIds, NOW, renderAt } from './helpers';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

async function fill(reps: string, kg: string, rpe?: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Reps'), reps);
  await user.type(screen.getByLabelText('Kg'), kg);
  if (rpe !== undefined) await user.type(screen.getByLabelText('RPE'), rpe);
  return user;
}

const prBox = (): HTMLElement => screen.getByTestId('pr-box');

describe('AddRecordScreen', () => {
  it('renders the mockup layout with the default exercise', async () => {
    renderAt('/records/add');
    expect(screen.getByRole('heading', { name: 'Ajouter un PR' })).toBeInTheDocument();
    expect(screen.getByText('Hors séance')).toBeInTheDocument();
    expect(screen.queryByText(/rattaché à/)).toBeNull();
    expect(await screen.findByRole('button', { name: /Exercice : Développé couché/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Classique' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: "Aujourd'hui" })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Lundi 23 novembre 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le PR' })).toBeInTheDocument();
  });

  it('announces a weight PR at the same reps', async () => {
    renderAt('/records/add');
    await fill('6', '95');
    expect(prBox()).toHaveTextContent('PRBat ton record à 6 reps : 92,5 kg du 10/03 (+2,5 kg)');
  });

  it('announces a reps PR at the same weight', async () => {
    renderAt('/records/add');
    await fill('7', '92,5');
    expect(prBox()).toHaveTextContent('Bat ton record à 6 reps : 92,5 kg du 10/03 (+1 rep)');
  });

  it('announces a hybrid PR', async () => {
    renderAt('/records/add');
    await fill('8', '95');
    expect(prBox()).toHaveTextContent('Bat ton record à 6 reps : 92,5 kg du 10/03 (+2,5 kg, +2 reps)');
  });

  it('announces an equaled record', async () => {
    renderAt('/records/add');
    await fill('6', '92.5');
    expect(prBox()).toHaveTextContent('ÉgaléÉgale ton record à 6 reps : 92,5 kg du 10/03');
  });

  it('announces a set below the record', async () => {
    renderAt('/records/add');
    await fill('6', '90');
    expect(prBox()).toHaveTextContent('Pas un PRTon record à 6 reps : 92,5 kg du 10/03 (-2,5 kg)');
  });

  it('announces a set dominated by a higher-reps record', async () => {
    renderAt('/records/add');
    await fill('1', '80');
    expect(prBox()).toHaveTextContent('Pas un PRTon record à 6 reps : 92,5 kg du 10/03');
  });

  it('announces data capture (lower weight, no record at these reps)', async () => {
    renderAt('/records/add');
    await fill('10', '50');
    expect(prBox()).toHaveTextContent('NouveauPremier record à 10 reps. Meilleure charge à moins de reps à 6 reps : 92,5 kg du 10/03');
  });

  it('announces a first record for a variant without history', async () => {
    const user = userEvent.setup();
    renderAt('/records/add');
    await user.click(await screen.findByRole('radio', { name: 'Pause' }));
    await fill('1', '100');
    expect(prBox()).toHaveTextContent('Premier record à 1 rep pour cette variante.');
  });

  it('compares against history before the chosen date (Autre)', async () => {
    const user = userEvent.setup();
    renderAt('/records/add');
    await fill('6', '91');
    expect(prBox()).toHaveTextContent('Pas un PR');
    await user.click(screen.getByRole('radio', { name: 'Autre' }));
    const date = screen.getByLabelText('Choisir la date');
    expect(date).toHaveAttribute('type', 'date');
    expect(date).toHaveAttribute('max', '2026-11-23');
    fireEvent.change(date, { target: { value: '2026-03-06' } });
    // Avant le 10/03 seule la série 6 × 90 du 05/03 existe à 6 reps.
    expect(prBox()).toHaveTextContent('Bat ton record à 6 reps : 90 kg du 05/03 (+1 kg)');
    expect(screen.getByText('Vendredi 6 mars 2026')).toBeInTheDocument();
    fireEvent.change(date, { target: { value: '2026-12-01' } });
    expect(screen.getByText('Date invalide ou dans le futur.')).toBeInTheDocument();
    expect(screen.queryByTestId('pr-box')).toBeNull();
  });

  it('uses yesterday as the performance date', async () => {
    const backend = createMockBackend(localStorage);
    const add = vi.spyOn(backend.performances, 'add');
    const { bench } = await exerciseIds(backend);
    const { router } = renderAt(`/records/add?exerciseId=${bench}`, backend);
    const user = await fill('6', '95', '9');
    await user.click(screen.getByRole('radio', { name: 'Hier' }));
    expect(screen.getByText('Dimanche 22 novembre 2026')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(add).toHaveBeenCalledWith([
      expect.objectContaining({
        exerciseId: bench,
        reps: 6,
        weight: 95,
        rpe: 9,
        sessionName: 'Ajout manuel',
        variantName: 'Touch and Go',
        performanceDate: '2026-11-22',
      }),
    ]);
    expect(await screen.findByText('PR enregistré.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/records/${bench}`);
  });

  it('saves today, returns to the records table and shows the new PR', async () => {
    const backend = createMockBackend(localStorage);
    const { bench } = await exerciseIds(backend);
    renderAt(`/records/add?exerciseId=${bench}`, backend);
    const user = await fill('2', '105');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(await screen.findByText('105 kg')).toBeInTheDocument();
    const row = screen.getByRole('rowheader', { name: '2' }).closest('tr');
    expect(row).toHaveAttribute('data-fresh', 'true');
    expect(within(row as HTMLElement).getByText('auj.')).toBeInTheDocument();
  });

  it('says « Performance enregistrée » when it is not a PR, keeping the variant', async () => {
    const backend = createMockBackend(localStorage);
    const { bench, pauseId } = await exerciseIds(backend);
    await backend.performances.add([benchPerf(bench, { reps: 5, weight: 80, variantId: pauseId, variantName: 'Pause', performanceDate: '2026-11-20' })]);
    const { router } = renderAt(`/records/add?exerciseId=${bench}&variant=Pause`, backend);
    const user = await fill('5', '70');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(await screen.findByText('Performance enregistrée.')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?variant=Pause');
  });

  it('validates the inputs before saving', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const add = vi.spyOn(backend.performances, 'add');
    renderAt('/records/add', backend);
    await user.type(await screen.findByLabelText('RPE'), '12');
    expect(screen.getByText('RPE : entier de 6 à 10.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(screen.getByText('Reps : nombre entier ≥ 1.')).toBeInTheDocument();
    expect(screen.getByText('Kg : nombre ≥ 0.')).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toHaveAttribute('aria-invalid', 'true');
    expect(add).not.toHaveBeenCalled();
  });

  it('is honest when the save is queued offline', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.performances, 'add').mockRejectedValue(new NetworkError('offline'));
    const { router } = renderAt('/records/add', backend);
    const user = await fill('6', '95');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(
      await screen.findByText('Hors ligne : performance mise en attente, elle sera envoyée au retour du réseau.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/records\/.+/);
    expect(router.state.location.pathname).not.toBe('/records/add');
  });

  it('stays on the screen and reports an error', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.performances, 'add').mockRejectedValue(new Error('refusé'));
    const { router } = renderAt('/records/add', backend);
    const user = await fill('6', '95');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(
      await screen.findByText("Échec de l'enregistrement, rien n'a été sauvegardé : refusé"),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/records/add');
  });

  it('changes exercise from the picker and resets the variant', async () => {
    const user = userEvent.setup();
    renderAt('/records/add?variant=Pause');
    await user.click(await screen.findByRole('button', { name: /Changer d'exercice/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Squat' }));
    expect(screen.getByRole('button', { name: /Exercice : Squat/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Classique' })).toHaveAttribute('aria-checked', 'true');
    await fill('5', '125');
    expect(prBox()).toHaveTextContent('Bat ton record à 5 reps : 122,5 kg du 10/03 (+2,5 kg)');
  });

  it('closes back to the records screen', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const { bench } = await exerciseIds(backend);
    const { router } = renderAt(`/records/add?exerciseId=${bench}`, backend);
    await screen.findByRole('button', { name: /Développé couché/ });
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(router.state.location.pathname).toBe(`/records/${bench}`);
  });

  it('reports a loading error and an empty catalogue', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.exercises, 'list').mockRejectedValueOnce(new NetworkError('x')).mockResolvedValue([]);
    renderAt('/records/add', backend);
    expect(await screen.findByText(/Impossible de charger les exercices/)).toBeInTheDocument();
  });

  it('explains an empty catalogue', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.exercises, 'list').mockResolvedValue([]);
    renderAt('/records/add', backend);
    expect(await screen.findByText("Aucun exercice : crée d'abord un exercice.")).toBeInTheDocument();
  });

  it('compares a past date against the whole day: re-entering yesterday’s set is equaled, not a PR', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const { bench } = await exerciseIds(backend);
    await backend.performances.add([benchPerf(bench, { reps: 6, weight: 95, performanceDate: '2026-11-22', sessionName: 'A1 Haut du corps' })]);
    renderAt(`/records/add?exerciseId=${bench}`, backend);
    await fill('6', '95');
    // Aujourd'hui : la série d'hier est antérieure → égalé.
    expect(prBox()).toHaveTextContent('Égale ton record à 6 reps : 95 kg du 22/11');
    await user.click(screen.getByRole('radio', { name: 'Hier' }));
    expect(prBox()).toHaveTextContent('Égale ton record à 6 reps : 95 kg du 22/11');
    expect(prBox()).not.toHaveTextContent('Bat ton record');
  });

  it('attaches the set to the session of that day when one exists', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const add = vi.spyOn(backend.performances, 'add');
    const { bench, squat } = await exerciseIds(backend);
    await backend.performances.add([
      benchPerf(bench, { reps: 6, weight: 80, performanceDate: '2026-11-22', sessionName: 'A1 Haut du corps' }),
      benchPerf(squat, { reps: 5, weight: 100, performanceDate: '2026-11-22', sessionName: 'A1 Haut du corps' }),
      benchPerf(bench, { reps: 1, weight: 60, performanceDate: '2026-11-22', sessionName: 'Autre' }),
      benchPerf(bench, { reps: 2, weight: 60, performanceDate: '2026-11-22', sessionName: 'Ajout manuel' }),
      benchPerf(bench, { reps: 3, weight: 60, performanceDate: '2026-11-22', sessionName: 'Ajout manuel' }),
    ]);
    add.mockClear();
    renderAt(`/records/add?exerciseId=${bench}`, backend);
    await fill('6', '95');
    expect(screen.queryByText(/rattaché à/)).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Hier' }));
    expect(screen.getByText(/rattaché à/)).toHaveTextContent('Dimanche 22 novembre 2026 · rattaché à A1 Haut du corps');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(add).toHaveBeenCalledWith([expect.objectContaining({ sessionName: 'A1 Haut du corps', performanceDate: '2026-11-22' })]);
  });

  it('prefers the planned session of the cycle active that day over a more frequent name', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const add = vi.spyOn(backend.performances, 'add');
    const { bench, squat } = await exerciseIds(backend);
    await backend.cycles.save({ current: 'A', startedOn: '2026-11-16', weeks: 2 });
    await backend.sessions.create({ name: 'Haut A', cycle: 'A', exercises: [{ exerciseId: bench, series: 3 }] });
    await backend.performances.add([
      benchPerf(bench, { reps: 6, weight: 80, performanceDate: '2026-11-22', sessionName: 'Autre' }),
      benchPerf(squat, { reps: 5, weight: 100, performanceDate: '2026-11-22', sessionName: 'Autre' }),
      benchPerf(bench, { reps: 1, weight: 60, performanceDate: '2026-11-22', sessionName: 'Haut A' }),
    ]);
    add.mockClear();
    renderAt(`/records/add?exerciseId=${bench}`, backend);
    await fill('6', '95');
    await user.click(screen.getByRole('radio', { name: 'Hier' }));
    expect(await screen.findByText(/rattaché à/)).toHaveTextContent('rattaché à Haut A');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le PR' }));
    expect(add).toHaveBeenCalledWith([expect.objectContaining({ sessionName: 'Haut A' })]);
  });

  it('blocks the PR box and saving until the history is loaded, with a retry on error', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const list = vi.spyOn(backend.performances, 'list').mockRejectedValueOnce(new NetworkError('offline'));
    const add = vi.spyOn(backend.performances, 'add');
    renderAt('/records/add', backend);
    await fill('6', '95');
    expect(await screen.findByText(/Impossible de charger ton historique/)).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('pr-box')).toBeNull();
    expect(screen.getByRole('button', { name: 'Enregistrer le PR' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('pr-box')).toHaveTextContent('Bat ton record');
    expect(screen.getByRole('button', { name: 'Enregistrer le PR' })).toBeEnabled();
    expect(list).toHaveBeenCalledTimes(2);
    expect(add).not.toHaveBeenCalled();
  });

  it('does not claim anything while the history is loading', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.performances, 'list').mockReturnValue(new Promise(() => undefined));
    renderAt('/records/add', backend);
    await fill('1', '200');
    expect(screen.getByText('Chargement de ton historique…')).toBeInTheDocument();
    expect(screen.queryByTestId('pr-box')).toBeNull();
    expect(screen.getByRole('button', { name: 'Enregistrer le PR' })).toBeDisabled();
  });
});
