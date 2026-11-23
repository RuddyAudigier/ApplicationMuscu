import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { Layout } from './Layout';

function Page({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Page title="Accueil" /> },
      { path: '/exercises', element: <Page title="Exercices" /> },
      { path: '/sessions', element: <Page title="Séances" /> },
      { path: '/workout', element: <Page title="Séance en cours" /> },
      { path: '/performances', element: <Page title="Performances" /> },
      { path: '/progress/:exerciseId?', element: <Page title="Progression" /> },
      { path: '/settings', element: <Page title="Réglages" /> },
      { path: '/shared/:id', element: <Page title="Séance partagée" /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
export const createTestRouter = (initialEntries: string[]) =>
  createMemoryRouter(routes, { initialEntries });
