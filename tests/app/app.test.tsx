import { render, renderHook, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { ErrorBoundary } from '../../src/app/ErrorBoundary';
import { BackendProvider, Providers, useBackend } from '../../src/app/providers';
import { createTestRouter } from '../../src/app/router';
import { createMockBackend } from '../../src/data/mock';
import { NetworkError, ValidationError } from '../../src/data/ports';

/** Les écrans lisent les données : rendu avec les providers et le backend mock. */
const renderApp = (entries: string[]) =>
  render(
    <Providers backend={createMockBackend(localStorage)}>
      <RouterProvider router={createTestRouter(entries)} />
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
    ['/workout', 'Séance en cours'],
    ['/report', 'Compte rendu'],
    ['/records', 'Records'],
    ['/records/abc', 'Records'],
    ['/records/add', 'Ajouter un PR'],
    ['/exercises', 'Exercices'],
    ['/exercises/abc', 'Fiche exercice'],
    ['/settings', 'Réglages'],
  ])('renders %s', (path, title) => {
    renderApp([path]);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it.each(['/sessions', '/performances', '/progress'])(
    'no longer serves %s',
    (path) => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      renderApp([path]);
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    },
  );
});

describe('layout navigation', () => {
  it.each(['/', '/program', '/records', '/exercises', '/settings'])(
    'shows the bottom nav on %s',
    (path) => {
      renderApp([path]);
      const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
      expect(nav).toBeInTheDocument();
      expect(screen.getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual([
        'Accueil',
        'Programme',
        'Records',
        'Exercices',
      ]);
    },
  );

  it('marks the current section', () => {
    renderApp(['/records/abc']);
    expect(screen.getByRole('link', { name: 'Records' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/workout', '/report'])('hides the bottom nav on %s', (path) => {
    renderApp([path]);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
