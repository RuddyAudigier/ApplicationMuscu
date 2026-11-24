import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { ExerciseDetailScreen, ExercisesScreen } from '@/features/exercises';
import { HomeScreen } from '@/features/home';
import { ProgramScreen } from '@/features/program';
import { AddRecordScreen, RecordsScreen } from '@/features/records';
import { ReportScreen } from '@/features/report';
import { ReviewScreen } from '@/features/review';
import { SettingsScreen } from '@/features/settings';
import { WorkoutScreen } from '@/features/workout';
import { Layout } from './Layout';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/program', element: <ProgramScreen /> },
      { path: '/workout', element: <WorkoutScreen /> },
      { path: '/report', element: <ReportScreen /> },
      { path: '/bilan', element: <ReviewScreen /> },
      { path: '/records/add', element: <AddRecordScreen /> },
      { path: '/records/:exerciseId?', element: <RecordsScreen /> },
      { path: '/exercises', element: <ExercisesScreen /> },
      { path: '/exercises/:id', element: <ExerciseDetailScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
export const createTestRouter = (initialEntries: string[]) =>
  createMemoryRouter(routes, { initialEntries });
