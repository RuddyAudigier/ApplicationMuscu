import type { CycleId, Id, IsoDate } from './model';
import type { Report } from './report';
import type { WorkoutState } from './workout';

/** Forme du jour à l'arrivée en salle. */
export type Form = 'frais' | 'fatigue';

/** Ressenti par exercice (ordre et libellés fixes). */
export const FEELINGS = [
  { id: 'fatigue', label: 'Fatigué' },
  { id: 'motive', label: 'Motivé' },
  { id: 'energique', label: 'Énergique' },
  { id: 'mou', label: 'Mou' },
] as const;
export type Feeling = (typeof FEELINGS)[number]['id'];

/** Exercice d'échauffement du catalogue. */
export interface WarmupItem { id: Id; name: string; detail: string }
/** Série de chauffe : jamais une performance, jamais classée PR. */
export interface WarmupSet { reps: number; weight: number | null }

export interface SessionLog {
  id: Id; date: IsoDate; sessionId: Id | null; sessionName: string; cycle: CycleId | null;
  form: Form | null; mood: string;
  exercises: { exerciseId: Id; name: string; feeling: Feeling | null; warmupSets: WarmupSet[] }[];
  warmupDone: { name: string; detail: string }[];
}

/** Journal : comptes rendus de séance, notes de bloc (clé = début du bloc) et échauffements. */
export interface Journal {
  logs: SessionLog[];
  blockNotes: Record<IsoDate, string>;
  warmups: { catalog: WarmupItem[]; bySession: Record<Id, Id[]> };
}

export const emptyJournal = (): Journal => ({
  logs: [], blockNotes: {}, warmups: { catalog: [], bySession: {} },
});

/** Remplace le compte rendu de même id ou l'ajoute ; triés par date croissante (ordre stable). */
export function upsertLog(j: Journal, log: SessionLog): Journal {
  const exists = j.logs.some((l) => l.id === log.id);
  const logs = exists ? j.logs.map((l) => (l.id === log.id ? log : l)) : [...j.logs, log];
  return { ...j, logs: logs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) };
}

/** Note du bloc commençant à `blockStart` ; vide ou blanche → supprimée. */
export function setBlockNote(j: Journal, blockStart: IsoDate, note: string): Journal {
  const blockNotes = Object.fromEntries(Object.entries(j.blockNotes).filter(([k]) => k !== blockStart));
  if (note.trim() !== '') blockNotes[blockStart] = note;
  return { ...j, blockNotes };
}

/** Compte rendu du journal tiré d'une séance terminée (exercices avec séries validées ou ressenti). */
export function logFromWorkout(state: WorkoutState, id: Id): SessionLog {
  return {
    id, date: state.date, sessionId: state.sessionId, sessionName: state.sessionName, cycle: state.cycle,
    form: state.form, mood: state.mood,
    exercises: state.exercises
      .filter((e) => e.feeling !== null || e.series.some((s) => s.validated))
      .map((e) => ({ exerciseId: e.exerciseId, name: e.name, feeling: e.feeling, warmupSets: [] })),
    warmupDone: [],
  };
}

/** Compte rendu du journal reconstruit depuis le compte rendu local (journal sans cet id). */
export function logFromReport(report: Report, id: Id): SessionLog {
  return {
    id, date: report.date, sessionId: null, sessionName: report.title, cycle: report.cycle,
    form: report.form, mood: report.mood,
    exercises: report.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, feeling: e.feeling, warmupSets: [] })),
    warmupDone: [],
  };
}

/** Reporte les modifications du compte rendu (forme, état général, ressentis) ; échauffements intacts. */
export function applyReportEdits(log: SessionLog, report: Report): SessionLog {
  return {
    ...log,
    form: report.form,
    mood: report.mood,
    exercises: log.exercises.map((e) => {
      const r = report.exercises.find((x) => x.exerciseId === e.exerciseId);
      return r ? { ...e, feeling: r.feeling } : e;
    }),
  };
}
