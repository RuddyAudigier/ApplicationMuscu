import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys, useJournal, useSaveJournal } from '@/data/queries';
import { emptyJournal, type Journal } from '@/domain/journal';

export const JOURNAL_NOT_SYNCED_MESSAGE = 'État non synchronisé : il reste dans ce compte rendu.';

/** Au-delà, la synchronisation est abandonnée (réseau muet) : l'appelant n'attend pas plus. */
const TIMEOUT_MS = 8000;

/** Écritures du journal l'une après l'autre : chacune relit le cache à jour avant d'écrire. */
let chain: Promise<unknown> = Promise.resolve();
/** Une écriture a expiré : elle peut encore aboutir plus tard, le cache n'est plus fiable avant relecture. */
let stale = false;

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
      const result = chain.then(async () => {
        if (stale) {
          // Après un délai dépassé : relire le serveur avant d'écrire, pour construire sur la vérité serveur.
          const fresh = await withTimeout(client.refetchQueries({ queryKey: queryKeys.journal }), TIMEOUT_MS).catch(
            () => undefined,
          );
          const state = client.getQueryState(queryKeys.journal);
          if (fresh === undefined || state?.status === 'error' || state?.fetchStatus === 'fetching') return false;
          stale = false;
        }
        const done = await withTimeout(run(), TIMEOUT_MS);
        if (done === undefined) {
          stale = true;
          return false;
        }
        return done;
      });
      chain = result;
      return result;
    },
    [client, refetch, mutateAsync],
  );
}
