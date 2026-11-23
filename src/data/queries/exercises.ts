import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { Exercise, ExerciseDraft, Id } from '../../domain/model';
import { useBackend } from '../context';
import { queryKeys } from './keys';

export function useExercises(): UseQueryResult<Exercise[]> {
  const { exercises } = useBackend();
  return useQuery({ queryKey: queryKeys.exercises, queryFn: () => exercises.list() });
}

export function useCreateExercise(): UseMutationResult<Exercise, Error, ExerciseDraft> {
  const { exercises } = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: ExerciseDraft) => exercises.create(draft),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.exercises }),
  });
}

export interface UpdateExerciseVars { id: Id; draft: ExerciseDraft }

/** Séances et performances embarquent le nom des exercices : elles sont rechargées aussi. */
export function useUpdateExercise(): UseMutationResult<Exercise, Error, UpdateExerciseVars> {
  const { exercises } = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateExerciseVars) => exercises.update(id, draft),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.exercises }),
      client.invalidateQueries({ queryKey: queryKeys.sessions }),
      client.invalidateQueries({ queryKey: queryKeys.performances }),
    ]),
  });
}

export function useDeleteExercise(): UseMutationResult<void, Error, Id> {
  const { exercises } = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => exercises.remove(id),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.exercises }),
      client.invalidateQueries({ queryKey: queryKeys.sessions }),
      client.invalidateQueries({ queryKey: queryKeys.performances }),
    ]),
  });
}
