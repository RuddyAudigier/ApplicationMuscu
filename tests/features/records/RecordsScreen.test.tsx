import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

const rowFor = (reps: number): HTMLElement => {
  const header = screen.getByRole('rowheader', { name: String(reps) });
  const row = header.closest('tr');
  if (!row) throw new Error('row');
  return row;
};

describe('RecordsScreen', () => {
  it('shows the 1–30 table for the first exercise with data, Classique selected', async () => {
    renderAt('/records');
    expect(await screen.findByRole('heading', { name: 'Records', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Exercice : Développé couché/ })).toBeInTheDocument();
    const variants = screen.getByRole('radiogroup', { name: 'Variante' });
    expect(within(variants).getByRole('radio', { name: 'Classique' })).toHaveAttribute('aria-checked', 'true');
    expect(within(variants).getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('rowheader')).toHaveLength(30);
    expect(within(rowFor(6)).getByText('92,5 kg')).toBeInTheDocument();
    expect(within(rowFor(6)).getByText('10/03')).toBeInTheDocument();
    // 5 × 90 est dominé par 6 × 92,5 (Pareto).
    expect(within(rowFor(5)).getByText('à conquérir')).toBeInTheDocument();
  });

  it('highlights PRs set this week in citron', async () => {
    const backend = createMockBackend(localStorage);
    const { bench } = await exerciseIds(backend);
    await backend.performances.add([benchPerf(bench, { reps: 3, weight: 110 })]);
    renderAt(`/records/${bench}`, backend);
    await screen.findByText('110 kg');
    const row = rowFor(3);
    expect(row).toHaveAttribute('data-fresh', 'true');
    expect(within(row).getByText('auj.')).toBeInTheDocument();
    expect(within(row).getByText('(PR cette semaine)')).toBeInTheDocument();
    expect(rowFor(6)).not.toHaveAttribute('data-fresh');
  });

  it('switches variant (records are separate per variant)', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/records');
    await screen.findByText('92,5 kg');
    await user.click(screen.getByRole('radio', { name: 'Pause' }));
    expect(screen.getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('92,5 kg')).toBeNull();
    expect(screen.getAllByText('à conquérir')).toHaveLength(30);
    expect(router.state.location.search).toBe('?variant=Pause');
    await user.click(screen.getByRole('radio', { name: 'Classique' }));
    expect(router.state.location.search).toBe('');
  });

  it('selects another exercise through the URL', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const { squat } = await exerciseIds(backend);
    const { router } = renderAt('/records', backend);
    await user.click(await screen.findByRole('button', { name: /Changer d'exercice/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choisir un exercice' });
    await user.click(within(dialog).getByRole('radio', { name: 'Squat' }));
    expect(router.state.location.pathname).toBe(`/records/${squat}`);
    expect(await screen.findByText('122,5 kg')).toBeInTheDocument();
  });

  it('falls back to the first exercise for an unknown id', async () => {
    renderAt('/records/inconnu');
    expect(await screen.findByRole('button', { name: /Développé couché/ })).toBeInTheDocument();
  });

  it('goes to the add screen with the exercise and variant', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const { bench } = await exerciseIds(backend);
    const { router } = renderAt(`/records/${bench}?variant=Pause`, backend);
    await user.click(await screen.findByRole('button', { name: 'Ajouter un PR' }));
    expect(router.state.location.pathname).toBe('/records/add');
    expect(router.state.location.search).toBe(`?exerciseId=${bench}&variant=Pause`);
    expect(await screen.findByRole('heading', { name: 'Ajouter un PR' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Pause' })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the estimated 1RM curve and progression stats', async () => {
    const user = userEvent.setup();
    renderAt('/records');
    await screen.findByText('92,5 kg');
    await user.click(screen.getByRole('radio', { name: 'Courbe' }));
    expect(screen.getByRole('img', { name: 'Courbe du 1RM estimé sur 3 séances' })).toBeInTheDocument();
    // 92,5 × (1 + 6/30) = 111 ; premier jour 90 × (1 + 5/30) = 105.
    expect(screen.getByText('1RM estimé max').previousSibling).toHaveTextContent('111kg');
    expect(screen.getByText('Progression 1RM').previousSibling).toHaveTextContent('+6kg');
    expect(screen.getByText('Séances').previousSibling).toHaveTextContent('3');
    expect(screen.getByRole('table', { name: '1RM estimé par date' })).toBeInTheDocument();
    const hits = screen.getAllByTestId('chart-hit');
    fireEvent.mouseEnter(hits[2] as Element);
    expect(screen.getByText(/le 10\/03\/2026/)).toHaveTextContent('111 kg le 10/03/2026');
    fireEvent.mouseLeave(hits[2] as Element);
    expect(screen.getByText('1RM estimé (Epley) par séance')).toBeInTheDocument();
  });

  it('shows an empty curve for a variant without data', async () => {
    const user = userEvent.setup();
    renderAt('/records?variant=Pause');
    await screen.findByRole('radio', { name: 'Courbe' });
    await user.click(screen.getByRole('radio', { name: 'Courbe' }));
    expect(screen.getByText('Pas encore de données')).toBeInTheDocument();
  });

  it('draws a single-point curve', async () => {
    const user = userEvent.setup();
    const backend = createMockBackend(localStorage);
    const { bench, pauseId } = await exerciseIds(backend);
    await backend.performances.add([benchPerf(bench, { variantId: pauseId, variantName: 'Pause' })]);
    renderAt(`/records/${bench}?variant=Pause`, backend);
    await user.click(await screen.findByRole('radio', { name: 'Courbe' }));
    expect(screen.getByRole('img', { name: 'Courbe du 1RM estimé sur 1 séance' })).toBeInTheDocument();
    expect(screen.getByText('Progression 1RM').previousSibling).toHaveTextContent('—');
  });

  it('reports a loading error honestly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.performances, 'list').mockRejectedValue(new NetworkError('offline'));
    renderAt('/records', backend);
    expect(await screen.findByText(/Impossible de charger les records/)).toHaveAttribute('role', 'alert');
  });

  it('shows an empty state without exercises', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.exercises, 'list').mockResolvedValue([]);
    renderAt('/records', backend);
    expect(await screen.findByText('Aucun exercice')).toBeInTheDocument();
  });
});

describe('CSV import (menu ⋯)', () => {
  const csv = (body: string) => new File([body], 'perfs.csv', { type: 'text/csv' });

  async function openMenu() {
    const user = userEvent.setup();
    await screen.findByText('92,5 kg');
    await user.click(screen.getByRole('button', { name: "Plus d'options" }));
    return { user, input: screen.getByLabelText(/Importer un CSV/) };
  }

  it('imports valid lines and lists per-line errors', async () => {
    renderAt('/records');
    const { user, input } = await openMenu();
    await user.upload(
      input,
      csv('exercice;reps;poids;date\nDéveloppé couché;2;105;20/11/2026\nFoo;3;50;20/11/2026\n'),
    );
    expect(await screen.findByText('1 ligne importée.')).toBeInTheDocument();
    expect(screen.getByText('1 ligne ignorée :')).toBeInTheDocument();
    expect(screen.getByText('Ligne 3: exercice introuvable (Foo).')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(await screen.findByText('105 kg')).toBeInTheDocument();
  });

  it('reports a file without valid lines', async () => {
    renderAt('/records');
    const { user, input } = await openMenu();
    await user.upload(input, csv('exercice;reps;poids\nFoo;3;50\nDéveloppé couché;x;50\n'));
    expect(await screen.findByText('Aucune ligne importée.')).toBeInTheDocument();
    expect(screen.getByText('2 lignes ignorées :')).toBeInTheDocument();
  });

  it('says when the import is queued offline', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.performances, 'add').mockRejectedValue(new NetworkError('offline'));
    renderAt('/records', backend);
    const { user, input } = await openMenu();
    await user.upload(input, csv('exercice,reps,poids\nSquat,5,100\nSquat,4,105\n'));
    expect(await screen.findByText(/Hors ligne : 2 lignes en attente/)).toBeInTheDocument();
  });

  it('says when the import failed', async () => {
    const backend = createMockBackend(localStorage);
    vi.spyOn(backend.performances, 'add').mockRejectedValue(new Error('refusé'));
    renderAt('/records', backend);
    const { user, input } = await openMenu();
    await user.upload(input, csv('exercice,reps,poids\nSquat,5,100\n'));
    expect(await screen.findByText("Import échoué, rien n'a été enregistré : refusé")).toBeInTheDocument();
  });

  it('ignores an empty selection', async () => {
    renderAt('/records');
    const { input } = await openMenu();
    fireEvent.change(input, { target: { files: [] } });
    await waitFor(() => {
      expect(screen.getByText('Importer un CSV')).toBeInTheDocument();
    });
    expect(screen.queryByText(/importée/)).toBeNull();
  });
});
