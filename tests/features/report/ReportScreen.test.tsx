import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleReport } from './fixtures';

const mocks = vi.hoisted(() => ({
  buildPdf: vi.fn(),
  shareFile: vi.fn(),
}));

vi.mock('@/platform/pdf', () => ({ buildPdf: mocks.buildPdf }));
vi.mock('@/platform/share', () => ({ shareFile: mocks.shareFile }));

import { ReportScreen } from '@/features/report';
import { saveLastReport } from '@/features/workout';
import { UiProvider } from '@/ui';

function renderScreen() {
  return render(
    <UiProvider>
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<ReportScreen />} />
          <Route path="/" element={<p>Accueil</p>} />
        </Routes>
      </MemoryRouter>
    </UiProvider>,
  );
}

describe('ReportScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    mocks.buildPdf.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  });

  it('shows an empty state with a link home when there is no report', async () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: 'Compte rendu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aucune séance terminée' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: "Retour à l'accueil" }));
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('renders header, stat tiles and per-exercise series', () => {
    saveLastReport(sampleReport);
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: 'Séance terminée' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cycle A')).toHaveTextContent('A');
    expect(screen.getByText(/Haut du corps · lundi 23\/11 · 52 min/)).toBeInTheDocument();
    expect(screen.getAllByText('PR')[0]?.parentElement).toHaveTextContent('2PR');
    expect(screen.getByText('séries').parentElement).toHaveTextContent('3séries');
    expect(screen.getByText('exercices').parentElement).toHaveTextContent('2exercices');

    const bench = screen.getByRole('list', { name: 'Séries — Développé couché' });
    const rows = within(bench).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('S1');
    expect(rows[0]).toHaveTextContent('4 × 100 kg');
    expect(rows[0]).toHaveTextContent('Classique');
    expect(rows[0]).toHaveTextContent('RPE 9');
    expect(within(rows[0] as HTMLElement).getByLabelText('PR, record de répétitions')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('5 × 82,5 kg');
    expect(within(rows[1] as HTMLElement).queryByText('PR')).toBeNull();
    expect(screen.getByText('1 série · fatigué')).toBeInTheDocument();
    expect(screen.getByLabelText('PR, record hybride')).toBeInTheDocument();
  });

  it('handles a report without cycle, series or PR kind', () => {
    saveLastReport({
      ...sampleReport,
      cycle: null,
      seriesCount: 1,
      exerciseCount: 1,
      exercises: [],
    });
    renderScreen();
    expect(screen.queryByLabelText(/^Cycle/)).toBeNull();
    expect(screen.getByText('série')).toBeInTheDocument();
    expect(screen.getByText('exercice')).toBeInTheDocument();
    expect(screen.getByText('Aucune série validée pendant cette séance.')).toBeInTheDocument();
  });

  it('shows a bare PR badge when the kind is unknown', () => {
    saveLastReport({
      ...sampleReport,
      exercises: [{ name: 'X', seriesLabel: '1 série', series: [{ n: 1, variant: 'Classique', reps: 1, weight: 1, rpe: 8, isPr: true, prKind: null }] }],
    });
    renderScreen();
    expect(screen.getByRole('list', { name: 'Séries — X' })).toContainElement(screen.getByLabelText('PR'));
  });

  it('builds the PDF and shares it with a sanitized file name', async () => {
    saveLastReport(sampleReport);
    mocks.shareFile.mockResolvedValue('shared');
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer au coach (PDF)' }));
    await screen.findByText('Compte rendu partagé.');
    const model = mocks.buildPdf.mock.calls[0]?.[0] as { title: string; summary: string };
    expect(model.title).toBe('Compte rendu · Haut du corps');
    expect(model.summary).toBe('2 PR · 3 séries · 2 exercices');
    const [file, meta] = mocks.shareFile.mock.calls[0] as [File, { dialogTitle: string }];
    expect(file.name).toBe('compte-rendu-haut-du-corps-2026-11-23.pdf');
    expect(file.type).toBe('application/pdf');
    expect(meta.dialogTitle).toBe('Envoyer au coach');
  });

  it('tells the user when the PDF was downloaded, stays quiet on cancel', async () => {
    saveLastReport(sampleReport);
    mocks.shareFile.mockResolvedValueOnce('downloaded').mockResolvedValueOnce('cancelled');
    renderScreen();
    const button = screen.getByRole('button', { name: 'Envoyer au coach (PDF)' });
    await userEvent.click(button);
    await screen.findByText('PDF téléchargé : compte-rendu-haut-du-corps-2026-11-23.pdf');
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    await userEvent.click(button);
    await waitFor(() => {
      expect(mocks.shareFile).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('Compte rendu partagé.')).toBeNull();
  });

  it('reports PDF generation errors', async () => {
    saveLastReport(sampleReport);
    mocks.buildPdf.mockRejectedValue(new Error('boom'));
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer au coach (PDF)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de générer le PDF.');
    expect(mocks.shareFile).not.toHaveBeenCalled();
  });

  it('links back home', async () => {
    saveLastReport(sampleReport);
    renderScreen();
    await userEvent.click(screen.getByRole('link', { name: "Retour à l'accueil" }));
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });
});
