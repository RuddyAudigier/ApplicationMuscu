import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useBackend } from '../context';

/** Réglages (mode mock) : remet les données de démonstration puis recharge toutes les requêtes. */
export function useResetBackend(): UseMutationResult<void, Error, void> {
  const backend = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!backend.reset) throw new Error('Réinitialisation disponible uniquement en mode mock.');
      await backend.reset();
    },
    onSuccess: () => client.resetQueries(),
  });
}
