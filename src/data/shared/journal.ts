import { z } from 'zod';
import type { Journal } from '../../domain/journal';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const feeling = z.enum(['fatigue', 'motive', 'energique', 'mou']);

const warmupSet = z.object({
  reps: z.number().catch(0),
  weight: z.number().nullable().catch(null),
});

const logSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  sessionId: z.string().nullable().catch(null),
  sessionName: z.string().catch(''),
  cycle: z.enum(['A', 'B']).nullable().catch(null),
  form: z.enum(['frais', 'fatigue']).nullable().catch(null),
  mood: z.string().catch(''),
  exercises: z.array(z.object({
    exerciseId: z.string(),
    name: z.string().catch(''),
    feeling: feeling.nullable().catch(null),
    warmupSets: z.array(warmupSet).catch([]),
  })).catch([]),
  warmupDone: z.array(z.object({ name: z.string(), detail: z.string().catch('') })).catch([]),
});

const emptyWarmups = () => ({ catalog: [], bySession: {} });

/**
 * Format stocké (Supabase `journal`, mock, repli local) ; champs invalides → défauts,
 * comptes rendus illisibles ignorés.
 */
export const journalSchema = z.object({
  logs: z.array(z.unknown()).catch([]).transform((arr) =>
    arr.flatMap((raw) => {
      const r = logSchema.safeParse(raw);
      return r.success ? [r.data] : [];
    })),
  blockNotes: z.record(isoDate, z.string()).catch({}),
  warmups: z.object({
    catalog: z.array(z.object({ id: z.string().min(1), name: z.string(), detail: z.string().catch('') })).catch([]),
    bySession: z.record(z.string(), z.array(z.string())).catch({}),
  }).catch(emptyWarmups),
});

export function parseJournal(raw: unknown): Journal | null {
  const parsed = journalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
