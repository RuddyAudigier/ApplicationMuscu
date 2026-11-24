/* Point d'entrée des écrans pour les données serveur (TanStack Query). */
export { BackendProvider, useBackend } from '../context';
export {
  failedCount, flush, OFFLINE_QUEUE_CORRUPT_KEY, OFFLINE_QUEUE_FAILED_KEY, pendingCount, useOfflineQueueStatus, useOfflineQueueSync,
  type FlushResult, type OfflineQueueStatus,
} from '../offlineQueue';
export { archiveCount } from '../shared/storage';
export { queryKeys } from './keys';
export { useCreateExercise, useDeleteExercise, useExercises, useUpdateExercise, type UpdateExerciseVars } from './exercises';
export { useDeleteSession, useSaveSession, useSessions, type SaveSessionVars } from './sessions';
export { useAddPerformances, useHistoryIndex, usePerformances, type AddPerformancesResult } from './performances';
export { useSaveCoachNotes, type SaveCoachNotesVars } from './coachNotes';
export { useAdvice, useSaveAdvice } from './advice';
export { useCycleState, useSaveCycleState } from './cycles';
export { useResetBackend } from './reset';
