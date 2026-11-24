export type Id = string;
export type IsoDate = string; // 'YYYY-MM-DD', fuseau local
export type IsoDateTime = string;

export interface Variant { id: Id | null; exerciseId: Id | null; name: string; isDefault: boolean }
export interface Exercise {
  id: Id; name: string; description: string; muscleGroups: string[];
  variants: Variant[]; isCustom: boolean; createdAt: IsoDateTime; coachNotes: string;
}
export interface ExerciseDraft { name: string; description: string; muscleGroups: string[]; variants: Variant[] }

export type CycleId = 'A' | 'B';
export interface CycleState { current: CycleId; startedOn: IsoDate; weeks: 2 | 3 }

/**
 * Semaine type, une par cycle : `days.A[0]` = lundi … `days.A[6]` = dimanche pendant les semaines A ;
 * valeur = id de la séance du cycle faite ce jour-là, `null` = repos.
 */
export interface WeekPlan { days: Record<CycleId, (Id | null)[]>; overrides: PlanOverride[] }
/** Exception ponctuelle d'une semaine : `week` = lundi, `day` = jour prévu (0 = lundi). */
export type PlanOverride =
  | { week: IsoDate; day: number; kind: 'moved'; date: IsoDate }
  | { week: IsoDate; day: number; kind: 'skipped' };

export interface SessionExercise { exerciseId: Id; name: string; series: number }
export interface Session { id: Id; name: string; createdAt: IsoDateTime; cycle: CycleId | null; exercises: SessionExercise[] }
export interface SessionDraft { name: string; cycle: CycleId | null; exercises: { exerciseId: Id; series: number }[] }

export interface Performance {
  id: Id; exerciseId: Id | null; exerciseName: string; sessionName: string;
  reps: number; weight: number | null; rpe: number | null;
  variantId: Id | null; variantName: string; serieNumber: number;
  performanceDate: IsoDate; createdAt: IsoDateTime | null; isBaseline?: true;
}
export type PerformanceInput = Omit<Performance, 'id' | 'createdAt' | 'isBaseline'>;

export interface GeneralAdvice { training: string; nutrition: string; sleep: string }

export type ComparisonType = 'same-reps' | 'lower-reps' | 'higher-reps';
export type ImprovementStatus = 'improved' | 'equaled' | 'below' | 'data-capture' | 'none';
export interface Reference { reps: number; weight: number; date: IsoDate; timestamp: number; comparisonType: ComparisonType }

export interface ShareSerie {
  serieNumber: number; reps: number | null; weight: number | null; rpe: number | null;
  variantId: Id | null; variantName: string | null;
  previousBestReps: number | null; previousBestWeight: number | null;
  previousBestDate: IsoDate | null; previousBestDateFr: string | null;
  previousBestComparisonType: ComparisonType | null;
  improvementStatus: ImprovementStatus; improvementDelta: number | null;
  improvementDeltaReps: number | null; isHybridPr: boolean; isRepsPr: boolean;
}
export interface SharePayload {
  shareType: 'completed-workout'; name: string; sharedAt: string; workoutDate: string;
  workoutDateISO: IsoDate;
  summary: { improved: number; equaled: number; below: number; dataCapture: number };
  exercises: { id: Id; name: string; muscleGroups: string[]; variants: Variant[]; coachNotes: string; seriesData: ShareSerie[] }[];
}
