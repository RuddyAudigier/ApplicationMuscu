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
      { path: '/program', element: <Page title="Programme" /> },
      { path: '/workout', element: <Page title="Séance en cours" /> },
      { path: '/report', element: <Page title="Compte rendu" /> },
      { path: '/records/add', element: <Page title="Ajouter un record" /> },
      { path: '/records/:exerciseId?', element: <Page title="Records" /> },
      { path: '/exercises', element: <Page title="Exercices" /> },
      { path: '/exercises/:id', element: <Page title="Fiche exercice" /> },
      { path: '/settings', element: <Page title="Réglages" /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
export const createTestRouter = (initialEntries: string[]) =>
  createMemoryRouter(routes, { initialEntries });
