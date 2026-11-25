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

const PENDING_KEY = 'mymuscle_pending_reports_v1';

function loadPendingReports(): Report[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((r): r is Report => typeof r === 'object' && r !== null && Array.isArray((r as Report).exercises))
      : [];
  } catch {
    return [];
  }
}

function savePendingReports(list: Report[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // Stockage indisponible : le rattrapage sera tenté depuis le dernier compte rendu seulement.
  }
}

/**
 * Rattrape un compte rendu absent du journal (séance terminée hors ligne). Retourne la relance,
 * sans attente ni message ; avec `auto`, elle part d'elle-même une fois le journal lu.
 */
export function usePendingReportSync(auto = false): () => void {
  const client = useQueryClient();
  const sync = useJournalSync();
  const { isSuccess } = useJournal();
  const flush = useCallback((): void => {
    // File locale des comptes rendus à rattraper : survit au démarrage de la séance suivante
    // (qui efface le dernier compte rendu), même hors ligne.
    const pending = loadPendingReports();
    const last = loadLastReport();
    if (last?.logId && !pending.some((r) => r.logId === last.logId)) pending.push(last);
    const cached = client.getQueryData<Journal | null>(queryKeys.journal);
    const todo = pending.filter((r) => r.logId && !cached?.logs.some((l) => l.id === r.logId));
    savePendingReports(todo);
    for (const report of todo) {
      void pushReport(sync, report).then((ok) => {
        if (ok) savePendingReports(loadPendingReports().filter((r) => r.logId !== report.logId));
      });
    }
  }, [client, sync]);
  const ran = useRef(false);
  useEffect(() => {
    if (!auto || !isSuccess || ran.current) return;
    ran.current = true;
    flush();
  }, [auto, isSuccess, flush]);
  return flush;
}
