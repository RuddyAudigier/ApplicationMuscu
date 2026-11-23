import type { Exercise, ExerciseDraft, Session, SessionDraft, Performance, PerformanceInput, GeneralAdvice, SharePayload, Id } from '../domain/model';

export interface ExercisesRepo { list(): Promise<Exercise[]>; create(d: ExerciseDraft): Promise<Exercise>; update(id: Id, d: ExerciseDraft): Promise<Exercise>; remove(id: Id): Promise<void> }
export interface SessionsRepo { list(): Promise<Session[]>; create(d: SessionDraft): Promise<Session>; update(id: Id, d: SessionDraft): Promise<Session>; remove(id: Id): Promise<void> }
export interface PerformancesRepo { list(): Promise<Performance[]>; add(inputs: PerformanceInput[]): Promise<{ written: number }> }
export interface CoachNotesRepo { listAll(): Promise<Record<Id, string>>; save(exerciseId: Id, notes: string): Promise<void> }
export interface SharedSessionsRepo { get(id: Id): Promise<SharePayload | null> }
export interface AdviceRepo { get(): Promise<GeneralAdvice | null>; save(a: GeneralAdvice): Promise<void> }
export interface DataBackend {
  kind: 'mock' | 'supabase';
  exercises: ExercisesRepo; sessions: SessionsRepo; performances: PerformancesRepo;
  coachNotes: CoachNotesRepo; shared: SharedSessionsRepo; advice: AdviceRepo;
  reset?: () => Promise<void>;
}
/** Erreur réseau (rejouable) vs validation (non rejouable). D8. */
export class NetworkError extends Error { override name = 'NetworkError' }
export class ValidationError extends Error { override name = 'ValidationError' }
