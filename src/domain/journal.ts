import type { CycleId, Id, IsoDate } from './model';
import { parseReps, parseWeight } from './numbers';
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

/** Séries de chauffe saisies → valides seulement (reps entier ≥ 1) ; poids absent ou invalide → `null`. */
export function toWarmupSets(rows: { reps: string; kg: string }[]): WarmupSet[] {
  const out: WarmupSet[] = [];
  for (const r of rows) {
    const reps = parseReps(r.reps);
    if (reps !== null && reps >= 1) out.push({ reps, weight: r.kg.trim() === '' ? null : parseWeight(r.kg) });
  }
  return out;
}

/** Échauffements d'une séance : éléments du catalogue dans l'ordre choisi, ids inconnus ignorés. */
export function warmupsForSession(j: Journal | null | undefined, sessionId: Id): WarmupItem[] {
  if (!j) return [];
  const byId = new Map(j.warmups.catalog.map((w) => [w.id, w]));
  return (j.warmups.bySession[sessionId] ?? []).flatMap((id) => byId.get(id) ?? []);
}

/** Supprime un élément du catalogue et de toutes les listes de séance. */
export function removeWarmupItem(j: Journal, id: Id): Journal {
  const bySession = Object.fromEntries(
    Object.entries(j.warmups.bySession).map(([sid, ids]) => [sid, ids.filter((x) => x !== id)]),
  );
  return { ...j, warmups: { catalog: j.warmups.catalog.filter((w) => w.id !== id), bySession } };
}

/** Compte rendu du journal tiré d'une séance terminée (exercices avec séries validées ou ressenti). */
export function logFromWorkout(state: WorkoutState, id: Id): SessionLog {
  return {
    id, date: state.date, sessionId: state.sessionId, sessionName: state.sessionName, cycle: state.cycle,
    form: state.form, mood: state.mood,
    exercises: state.exercises
      .filter((e) => e.feeling !== null || e.series.some((s) => s.validated))
      .map((e) => ({ exerciseId: e.exerciseId, name: e.name, feeling: e.feeling, warmupSets: toWarmupSets(e.warmupSets) })),
    warmupDone: state.warmup.filter((w) => w.done).map((w) => ({ name: w.name, detail: w.detail })),
  };
}

/** Compte rendu du journal reconstruit depuis le compte rendu local (journal sans cet id). */
export function logFromReport(report: Report, id: Id): SessionLog {
  return {
    id, date: report.date, sessionId: null, sessionName: report.title, cycle: report.cycle,
    form: report.form, mood: report.mood,
    exercises: report.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, feeling: e.feeling, warmupSets: e.warmupSets })),
    warmupDone: report.warmup,
  };
}

/** Reporte les modifications du compte rendu (forme, état général, ressentis) ; échauffements intacts. */
export function applyReportEdits(log: SessionLog, report: Report): SessionLog {
  const sameLength = log.exercises.length === report.exercises.length;
  const rank = (list: SessionLog['exercises'], i: number): number =>
    list.slice(0, i).filter((x) => x.exerciseId === list[i]?.exerciseId).length;
  return {
    ...log,
    form: report.form,
    mood: report.mood,
    exercises: log.exercises.map((e, i) => {
      // Même nombre d'exercices : appariés par position (comptes rendus anciens sans exerciseId) ;
      // sinon par exerciseId et rang d'occurrence.
      const r = sameLength
        ? report.exercises[i]
        : report.exercises.filter((x) => x.exerciseId === e.exerciseId)[rank(log.exercises, i)];
      return r ? { ...e, feeling: r.feeling } : e;
    }),
  };
}
