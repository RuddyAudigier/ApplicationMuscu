import { render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { Providers } from '../../src/app/providers';
import { createTestRouter } from '../../src/app/router';
import { createMockBackend } from '../../src/data/mock';

describe('app smoke', () => {
  it('renders home route', () => {
    render(
      <Providers backend={createMockBackend(localStorage)}>
        <RouterProvider router={createTestRouter(['/'])} />
      </Providers>,
    );
    expect(screen.getByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
  });
});
