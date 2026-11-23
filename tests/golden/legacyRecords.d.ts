// Types minimaux de l'oracle legacy (legacyRecords.js, JS non typé).
export interface LegacyReference {
  reps: number;
  weight: number;
  date: string;
  timestamp: number;
  comparisonType: 'same-reps' | 'lower-reps' | 'higher-reps';
}
export type LegacyIndex = Map<string, Map<number, unknown[]>>;

export function buildHistoryIndex(historyPerformances: readonly object[]): LegacyIndex;
export function findPreviousBest(
  index: LegacyIndex,
  exerciseId: string | null,
  performance: object,
): LegacyReference | null;
