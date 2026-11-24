import type { CycleId, Id, IsoDate } from './model';

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
