import type { CycleId, Id, Session } from '@/domain/model';

/**
 * Code de séance (« A1 », « B2 ») : rang dans son cycle, séances triées par création puis id
 * (même ordre que l'écran Programme). `null` sans cycle ou si la séance n'est plus dans ce cycle.
 */
export function sessionCode(sessions: Session[], sessionId: Id, cycle: CycleId | null): string | null {
  if (cycle === null) return null;
  const rank = sessions
    .filter((s) => s.cycle === cycle)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .findIndex((s) => s.id === sessionId);
  return rank < 0 ? null : `${cycle}${String(rank + 1)}`;
}
