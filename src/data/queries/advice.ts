import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { GeneralAdvice } from '../../domain/model';
import { useBackend } from '../context';
import { queryKeys } from './keys';
import { onlineOnly, requireOnline } from './online';

export function useAdvice(): UseQueryResult<GeneralAdvice | null> {
  const { advice } = useBackend();
  return useQuery({ queryKey: queryKeys.advice, queryFn: () => advice.get() });
}

export function useSaveAdvice(): UseMutationResult<void, Error, GeneralAdvice> {
  const { advice } = useBackend();
  const client = useQueryClient();
  return useMutation({
    ...onlineOnly,
    mutationFn: requireOnline((a: GeneralAdvice) => advice.save(a)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.advice }),
  });
}
