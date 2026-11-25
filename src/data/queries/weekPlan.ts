import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { WeekPlan } from '../../domain/model';
import { useBackend } from '../context';
import { queryKeys } from './keys';
import { onlineOnly, requireOnline } from './online';

/** Semaine type ; `data === null` tant qu'elle n'a jamais été réglée. */
export function useWeekPlan(): UseQueryResult<WeekPlan | null> {
  const { weekPlan } = useBackend();
  return useQuery({ queryKey: queryKeys.weekPlan, queryFn: () => weekPlan.get() });
}

/** Enregistre la semaine type ou un décalage / saut ; le cache est mis à jour aussitôt. */
export function useSaveWeekPlan(): UseMutationResult<void, Error, WeekPlan> {
  const { weekPlan } = useBackend();
  const client = useQueryClient();
  return useMutation({
    ...onlineOnly,
    mutationFn: requireOnline((p: WeekPlan) => weekPlan.save(p)),
    onSuccess: async (_v, p) => {
      client.setQueryData(queryKeys.weekPlan, p);
      await client.invalidateQueries({ queryKey: queryKeys.weekPlan });
    },
  });
}
