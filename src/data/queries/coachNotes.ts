import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Id } from '../../domain/model';
import { useBackend } from '../context';
import { queryKeys } from './keys';
import { onlineOnly, requireOnline } from './online';

export interface SaveCoachNotesVars { exerciseId: Id; notes: string }

/** Les remarques sont portées par `Exercise.coachNotes` : les exercices sont rechargés. */
export function useSaveCoachNotes(): UseMutationResult<void, Error, SaveCoachNotesVars> {
  const { coachNotes } = useBackend();
  const client = useQueryClient();
  return useMutation({
    ...onlineOnly,
    mutationFn: requireOnline(({ exerciseId, notes }: SaveCoachNotesVars) => coachNotes.save(exerciseId, notes)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.exercises }),
  });
}
