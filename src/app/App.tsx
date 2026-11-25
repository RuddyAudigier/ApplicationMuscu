import { useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { ErrorBoundary } from './ErrorBoundary';
import { Providers } from './providers';
import { createAppRouter } from './router';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <ErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  );
}
