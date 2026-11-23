import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Performance, PerformanceInput } from '../../domain/model';
import { buildHistoryIndex, type HistoryIndex } from '../../domain/records';
import { useBackend } from '../context';
import { enqueue } from '../offlineQueue';
import { NetworkError } from '../ports';
import { queryKeys } from './keys';

export function usePerformances(): UseQueryResult<Performance[]> {
  const { performances } = useBackend();
  return useQuery({ queryKey: queryKeys.performances, queryFn: () => performances.list() });
}

export interface AddPerformancesResult {
  /** Nombre de lignes réellement écrites (séries à 0 rep exclues, D7). */
  written: number;
  /** `true` : réseau indisponible, lot mis en file locale et rejoué plus tard (D8). */
  queued: boolean;
}

/** Seule une `NetworkError` met en file ; toute autre erreur est rejetée telle quelle. */
export function useAddPerformances(): UseMutationResult<AddPerformancesResult, Error, PerformanceInput[]> {
  const { performances } = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: PerformanceInput[]): Promise<AddPerformancesResult> => {
      try {
        const { written } = await performances.add(inputs);
        return { written, queued: false };
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e;
        enqueue(inputs);
        return { written: 0, queued: true };
      }
    },
    onSuccess: async ({ queued }) => {
      if (!queued) await client.invalidateQueries({ queryKey: queryKeys.performances });
    },
  });
}

const EMPTY: Performance[] = [];

/** Index d'historique pour la détection de PR, recalculé seulement quand les performances changent. */
export function useHistoryIndex(): HistoryIndex {
  const { data } = usePerformances();
  const perfs = data ?? EMPTY;
  return useMemo(() => buildHistoryIndex(perfs), [perfs]);
}
