import type { CycleState, Exercise, ExerciseDraft, Session, SessionDraft, Performance, PerformanceInput, GeneralAdvice, Id } from '../domain/model';

export interface ExercisesRepo { list(): Promise<Exercise[]>; create(d: ExerciseDraft): Promise<Exercise>; update(id: Id, d: ExerciseDraft): Promise<Exercise>; remove(id: Id): Promise<void> }
export interface SessionsRepo { list(): Promise<Session[]>; create(d: SessionDraft): Promise<Session>; update(id: Id, d: SessionDraft): Promise<Session>; remove(id: Id): Promise<void> }
export interface PerformancesRepo { list(): Promise<Performance[]>; add(inputs: PerformanceInput[]): Promise<{ written: number }> }
export interface CoachNotesRepo { listAll(): Promise<Record<Id, string>>; save(exerciseId: Id, notes: string): Promise<void> }
export interface AdviceRepo { get(): Promise<GeneralAdvice | null>; save(a: GeneralAdvice): Promise<void> }
/** État du cycle A/B en cours (singleton) ; `null` tant qu'il n'a jamais été réglé. */
export interface CyclesRepo { get(): Promise<CycleState | null>; save(s: CycleState): Promise<void> }
export interface DataBackend {
  kind: 'mock' | 'supabase';
  exercises: ExercisesRepo; sessions: SessionsRepo; performances: PerformancesRepo;
  coachNotes: CoachNotesRepo; advice: AdviceRepo; cycles: CyclesRepo;
  reset?: () => Promise<void>;
}
/** Erreur réseau (rejouable) vs validation (non rejouable). D8. */
export class NetworkError extends Error { override name = 'NetworkError' }
export class ValidationError extends Error { override name = 'ValidationError' }
