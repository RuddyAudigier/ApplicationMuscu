import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { Journal } from '../../domain/journal';
import { useBackend } from '../context';
import { queryKeys } from './keys';
import { onlineOnly, requireOnline } from './online';

/** Journal ; `data === null` tant qu'il n'a jamais été enregistré. */
export function useJournal(): UseQueryResult<Journal | null> {
  const { journal } = useBackend();
  return useQuery({ queryKey: queryKeys.journal, queryFn: () => journal.get() });
}

/** Enregistre le journal entier ; le cache est mis à jour aussitôt. */
export function useSaveJournal(): UseMutationResult<void, Error, Journal> {
  const { journal } = useBackend();
  const client = useQueryClient();
  return useMutation({
    ...onlineOnly,
    mutationFn: requireOnline((j: Journal) => journal.save(j)),
    onSuccess: async (_v, j) => {
      client.setQueryData(queryKeys.journal, j);
      await client.invalidateQueries({ queryKey: queryKeys.journal });
    },
  });
}
