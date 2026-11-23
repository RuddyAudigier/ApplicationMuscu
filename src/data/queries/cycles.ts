import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { CycleState } from '../../domain/model';
import { useBackend } from '../context';
import { queryKeys } from './keys';

/** État du cycle A/B ; `data === null` tant qu'il n'a jamais été réglé (l'écran choisit le défaut). */
export function useCycleState(): UseQueryResult<CycleState | null> {
  const { cycles } = useBackend();
  return useQuery({ queryKey: queryKeys.cycleState, queryFn: () => cycles.get() });
}

/** Enregistre l'état (prolongation, bascule, réglage manuel) ; le cache est mis à jour aussitôt. */
export function useSaveCycleState(): UseMutationResult<void, Error, CycleState> {
  const { cycles } = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (s: CycleState) => cycles.save(s),
    onSuccess: async (_v, s) => {
      client.setQueryData(queryKeys.cycleState, s);
      await client.invalidateQueries({ queryKey: queryKeys.cycleState });
    },
  });
}
