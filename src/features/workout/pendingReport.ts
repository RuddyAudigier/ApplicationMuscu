import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { queryKeys, useJournal } from '@/data/queries';
import { applyReportEdits, logFromReport, upsertLog, type Journal } from '@/domain/journal';
import type { Report } from '@/domain/report';
import { loadLastReport } from './storage';
import { useJournalSync } from './useJournalSync';

/** Upsert du compte rendu dans le journal (même id) ; `false` si non synchronisé. */
export function pushReport(sync: ReturnType<typeof useJournalSync>, next: Report): Promise<boolean> {
  const logId = next.logId ?? '';
  return sync((j) => {
    const existing = j.logs.find((l) => l.id === logId);
    return upsertLog(j, existing ? applyReportEdits(existing, next) : logFromReport(next, logId));
  });
}

/**
 * Journal fixé pour démarrer une séance : lu, en erreur ou hors ligne (requête en pause) ;
 * sinon les échauffements seraient perdus en silence. Erreur ou pause : démarrage sans échauffements.
 */
export const isJournalSettled = (q: { isSuccess: boolean; isError: boolean; fetchStatus: string }): boolean =>
  q.isSuccess || q.isError || q.fetchStatus === 'paused';

/**
 * Rattrape un compte rendu absent du journal (séance terminée hors ligne). Retourne la relance,
 * sans attente ni message ; avec `auto`, elle part d'elle-même une fois le journal lu.
 */
export function usePendingReportSync(auto = false): () => void {
  const client = useQueryClient();
  const sync = useJournalSync();
  const { isSuccess } = useJournal();
  const flush = useCallback((): void => {
    const report = loadLastReport();
    if (!report?.logId) return;
    const cached = client.getQueryData<Journal | null>(queryKeys.journal);
    if (cached?.logs.some((l) => l.id === report.logId)) return;
    void pushReport(sync, report);
  }, [client, sync]);
  const ran = useRef(false);
  useEffect(() => {
    if (!auto || !isSuccess || ran.current) return;
    ran.current = true;
    flush();
  }, [auto, isSuccess, flush]);
  return flush;
}
