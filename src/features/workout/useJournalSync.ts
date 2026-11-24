import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys, useJournal, useSaveJournal } from '@/data/queries';
import { emptyJournal, type Journal } from '@/domain/journal';

export const JOURNAL_NOT_SYNCED_MESSAGE = 'État non synchronisé : il reste dans ce compte rendu.';

/** Au-delà, la synchronisation est abandonnée (réseau muet) : l'appelant n'attend pas plus. */
const TIMEOUT_MS = 8000;

/** Écritures du journal l'une après l'autre : chacune relit le cache à jour avant d'écrire. */
let chain: Promise<unknown> = Promise.resolve();

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(undefined);
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });

/**
 * Applique `edit` au journal puis l'enregistre. `false` si le journal n'a pas pu être lu ou écrit
 * (hors ligne, erreur, délai) : on n'écrase jamais un journal qu'on n'a pas pu lire. Ne rejette jamais.
 */
export function useJournalSync(): (edit: (j: Journal) => Journal) => Promise<boolean> {
  const client = useQueryClient();
  const { refetch } = useJournal();
  const { mutateAsync } = useSaveJournal();
  return useCallback(
    (edit) => {
      const run = async (): Promise<boolean> => {
        try {
          // Hors ligne, la lecture et l'écriture resteraient en pause : on abandonne tout de suite.
          if (!navigator.onLine) return false;
          // `null` = journal jamais enregistré ; `undefined` = pas encore lu.
          let current = client.getQueryData<Journal | null>(queryKeys.journal);
          if (current === undefined) current = (await refetch()).data;
          if (current === undefined) return false;
          await mutateAsync(edit(current ?? emptyJournal()));
          return true;
        } catch (e) {
          console.error('[journal] Synchronisation impossible :', e);
          return false;
        }
      };
      // Lecture et écriture bornées : une écriture en pause (réseau coupé) ne bloque pas la file.
      const result = chain.then(async () => (await withTimeout(run(), TIMEOUT_MS)) ?? false);
      chain = result;
      return result;
    },
    [client, refetch, mutateAsync],
  );
}
