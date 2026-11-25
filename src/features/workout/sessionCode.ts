import type { CycleId, Id, Session } from '@/domain/model';

/**
 * Libellé de cycle de la séance (« Cycle A »). `null` sans cycle ou si la séance n'est plus dans ce cycle.
 */
export function sessionCode(sessions: Session[], sessionId: Id, cycle: CycleId | null): string | null {
  if (cycle === null) return null;
  return sessions.some((s) => s.cycle === cycle && s.id === sessionId) ? `Cycle ${cycle}` : null;
}
