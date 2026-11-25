/* Point d'entrée des écrans pour les données serveur (TanStack Query). */
export { BackendProvider, useBackend } from '../context';
export {
  failedCount, flush, MOCK_QUEUE_KEYS, OFFLINE_QUEUE_CORRUPT_KEY, OFFLINE_QUEUE_FAILED_KEY, pendingCount, queueKeysFor, resendArchived,
  SUPABASE_QUEUE_KEYS, useOfflineQueueStatus, useOfflineQueueSync,
  type FlushResult, type OfflineQueueStatus, type QueueKeys,
} from '../offlineQueue';
export { archiveCount } from '../shared/storage';
export { queryKeys } from './keys';
export { useCreateExercise, useDeleteExercise, useExercises, useUpdateExercise, type UpdateExerciseVars } from './exercises';
export { useDeleteSession, useSaveSession, useSessions, type SaveSessionVars } from './sessions';
export { useAddPerformances, useHistoryIndex, usePerformances, type AddPerformancesResult } from './performances';
export { useSaveCoachNotes, type SaveCoachNotesVars } from './coachNotes';
export { useAdvice, useSaveAdvice } from './advice';
export { useCycleState, useSaveCycleState } from './cycles';
export { useSaveWeekPlan, useWeekPlan } from './weekPlan';
export { useJournal, useSaveJournal } from './journal';
export { useResetBackend } from './reset';
