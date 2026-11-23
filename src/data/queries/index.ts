/* Point d'entrée des écrans pour les données serveur (TanStack Query). */
export { BackendProvider, useBackend } from '../context';
export { pendingCount, useOfflineQueueSync } from '../offlineQueue';
export { queryKeys } from './keys';
export { useCreateExercise, useDeleteExercise, useExercises, useUpdateExercise, type UpdateExerciseVars } from './exercises';
export { useDeleteSession, useSaveSession, useSessions, type SaveSessionVars } from './sessions';
export { useAddPerformances, useHistoryIndex, usePerformances, type AddPerformancesResult } from './performances';
export { useSaveCoachNotes, type SaveCoachNotesVars } from './coachNotes';
export { useAdvice, useSaveAdvice } from './advice';
export { useCycleState, useSaveCycleState } from './cycles';
