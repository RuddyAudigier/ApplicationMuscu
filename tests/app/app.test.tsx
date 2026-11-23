import { render, renderHook, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { ErrorBoundary } from '../../src/app/ErrorBoundary';
import { BackendProvider, Providers, useBackend } from '../../src/app/providers';
import { createTestRouter } from '../../src/app/router';
import { createMockBackend } from '../../src/data/mock';
import { NetworkError, ValidationError } from '../../src/data/ports';

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
    render(<ErrorBoundary><p>ok</p></ErrorBoundary>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

describe('providers', () => {
  it('renders children', () => {
    render(<Providers backend={createMockBackend(localStorage)}><p>contenu</p></Providers>);
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
    ['/exercises', 'Exercices'],
    ['/sessions', 'Séances'],
    ['/workout', 'Séance en cours'],
    ['/performances', 'Performances'],
    ['/progress', 'Progression'],
    ['/progress/abc', 'Progression'],
    ['/settings', 'Réglages'],
    ['/shared/xyz', 'Séance partagée'],
  ])('renders %s', (path, title) => {
    render(<RouterProvider router={createTestRouter([path])} />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });
});
