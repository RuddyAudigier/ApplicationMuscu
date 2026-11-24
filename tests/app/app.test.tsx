import { render, renderHook, screen, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { ErrorBoundary } from '../../src/app/ErrorBoundary';
import { BackendProvider, Providers, useBackend } from '../../src/app/providers';
import { createTestRouter } from '../../src/app/router';
import { createMockBackend } from '../../src/data/mock';
import { NetworkError, ValidationError } from '../../src/data/ports';
import { startWorkout } from '../../src/domain/workout';
import { saveActiveWorkout } from '../../src/features/workout';

/** Les écrans lisent les données : on les monte dans les vrais providers, backend mock. */
const renderRoute = (path: string) =>
  render(
    <Providers backend={createMockBackend(localStorage)}>
      <RouterProvider router={createTestRouter([path])} />
    </Providers>,
  );

describe('ErrorBoundary', () => {
  it('shows a French fallback when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Boom = (): never => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>ok</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

describe('providers', () => {
  it('renders children', () => {
    render(
      <Providers backend={createMockBackend(localStorage)}>
        <p>contenu</p>
      </Providers>,
    );
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('useBackend throws without a BackendProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useBackend())).toThrow('Backend non configuré');
  });

  it('useBackend returns the provided backend', () => {
    const backend = createMockBackend(localStorage);
    const { result } = renderHook(() => useBackend(), {
      wrapper: ({ children }) => <BackendProvider backend={backend}>{children}</BackendProvider>,
    });
    expect(result.current).toBe(backend);
  });
});

describe('data errors', () => {
  it('NetworkError and ValidationError are named Errors', () => {
    const n = new NetworkError('x');
    const v = new ValidationError('y');
    expect(n).toBeInstanceOf(Error);
    expect(n.name).toBe('NetworkError');
    expect(v).toBeInstanceOf(Error);
    expect(v.name).toBe('ValidationError');
    expect(n).not.toBeInstanceOf(ValidationError);
  });
});

describe('router placeholders', () => {
  it.each([
    ['/', 'Accueil'],
    ['/program', 'Programme'],
    ['/report', 'Compte rendu'],
    ['/records', 'Records'],
    ['/records/abc', 'Records'],
    ['/records/add', 'Ajouter un record'],
    ['/exercises', 'Exercices'],
    ['/exercises/abc', 'Fiche exercice'],
    ['/settings', 'Réglages'],
  ])('renders %s', (path, title) => {
    renderRoute(path);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it.each(['/sessions', '/performances', '/progress'])(
    'no longer serves %s',
    (path) => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      renderRoute(path);
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    },
  );
});

describe('layout navigation', () => {
  it.each(['/', '/program', '/records', '/exercises', '/settings'])(
    'shows the bottom nav on %s',
    (path) => {
      renderRoute(path);
      const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
      expect(nav).toBeInTheDocument();
      expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual([
        'Accueil',
        'Programme',
        'Records',
        'Exercices',
      ]);
    },
  );

  it('marks the current section', () => {
    renderRoute('/records/abc');
    expect(screen.getByRole('link', { name: 'Records' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/report'])('hides the bottom nav on %s', (path) => {
    renderRoute(path);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('hides the bottom nav on /workout (séance en cours)', async () => {
    const backend = createMockBackend(localStorage);
    const exercises = await backend.exercises.list();
    const [session] = await backend.sessions.list();
    if (!session) throw new Error('seed');
    saveActiveWorkout(startWorkout(session, exercises, new Date()));
    render(
      <Providers backend={backend}>
        <RouterProvider router={createTestRouter(['/workout'])} />
      </Providers>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Développé couché' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('redirects /workout to home without an active workout', () => {
    renderRoute('/workout');
    expect(screen.getByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
  });
});
