import { render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { createTestRouter } from '../../src/app/router';

describe('app smoke', () => {
  it('renders home route', () => {
    render(<RouterProvider router={createTestRouter(['/'])} />);
    expect(screen.getByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
  });
});
