import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { Id, Session, SessionDraft } from '../../domain/model';
import { useBackend } from '../context';
import { queryKeys } from './keys';
import { onlineOnly, requireOnline } from './online';

export function useSessions(): UseQueryResult<Session[]> {
  const { sessions } = useBackend();
  return useQuery({ queryKey: queryKeys.sessions, queryFn: () => sessions.list() });
}

export interface SaveSessionVars { id?: Id | null; draft: SessionDraft }

/** Crée sans `id`, met à jour avec. Une mise à jour peut renommer les performances (D5). */
export function useSaveSession(): UseMutationResult<Session, Error, SaveSessionVars> {
  const { sessions } = useBackend();
  const client = useQueryClient();
  return useMutation({
    ...onlineOnly,
    mutationFn: requireOnline(({ id, draft }: SaveSessionVars) => (id ? sessions.update(id, draft) : sessions.create(draft))),
    onSuccess: async (_session, { id }) => {
      await client.invalidateQueries({ queryKey: queryKeys.sessions });
      if (id) await client.invalidateQueries({ queryKey: queryKeys.performances });
    },
  });
}

export function useDeleteSession(): UseMutationResult<void, Error, Id> {
  const { sessions } = useBackend();
  const client = useQueryClient();
  return useMutation({
    ...onlineOnly,
    mutationFn: requireOnline((id: Id) => sessions.remove(id)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}
