import { useCallback } from 'react';
import { useJournal, useSaveJournal } from '@/data/queries';
import { emptyJournal, type Journal } from '@/domain/journal';

export const JOURNAL_NOT_SYNCED_MESSAGE = 'État non synchronisé : il reste dans ce compte rendu.';

/**
 * Applique `edit` au journal puis l'enregistre. `false` si le journal n'a pas pu être lu ou écrit
 * (hors ligne, erreur) : on n'écrase jamais un journal qu'on n'a pas pu lire.
 */
export function useJournalSync(): (edit: (j: Journal) => Journal) => Promise<boolean> {
  const query = useJournal();
  const save = useSaveJournal();
  const { isSuccess, data, refetch } = query;
  const { mutateAsync } = save;
  return useCallback(
    async (edit) => {
      try {
        // `null` = journal jamais enregistré ; `undefined` = lecture impossible.
        const current = isSuccess ? data : (await refetch()).data;
        if (current === undefined) return false;
        await mutateAsync(edit(current ?? emptyJournal()));
        return true;
      } catch (e) {
        console.error('[journal] Synchronisation impossible :', e);
        return false;
      }
    },
    [isSuccess, data, refetch, mutateAsync],
  );
}
