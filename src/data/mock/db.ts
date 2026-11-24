import { z } from 'zod';
import type { Id } from '../../domain/model';
import { buildSeed } from './seed';

const MOCK_DB_STORAGE_KEY = 'local_test_db_v2';
const MOCK_DB_VERSION = 2;

const variantSchema = z.object({ id: z.string().nullable(), exerciseId: z.string().nullable(), name: z.string(), isDefault: z.boolean() });

const mockDbSchema = z.object({
  version: z.literal(MOCK_DB_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  exercises: z.array(z.object({
    id: z.string(), name: z.string(), description: z.string(), muscleGroups: z.array(z.string()),
    variants: z.array(variantSchema), isCustom: z.boolean(), createdAt: z.string(),
  })),
  sessions: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.string(), cycle: z.enum(['A', 'B']).nullish() })),
  sessionExercises: z.array(z.object({ sessionId: z.string(), exerciseId: z.string(), seriesCount: z.number() })),
  /** Lignes snake_case comme la table `performances` (validées à la lecture par le mapper partagé). */
  performances: z.array(z.record(z.string(), z.unknown())),
  coachNotesByExerciseId: z.record(z.string(), z.object({ notes: z.string(), updatedAt: z.string() })),
  generalAdvice: z.object({ training: z.string(), nutrition: z.string(), sleep: z.string(), updatedAt: z.string() }).nullable(),
  /** Absent des bases créées avant les cycles (Task 21) : lu comme `null`, sans réinitialiser. */
  cycleState: z.object({ current: z.enum(['A', 'B']), startedOn: z.string(), weeks: z.union([z.literal(2), z.literal(3)]) }).nullish(),
});

export type MockDb = z.infer<typeof mockDbSchema>;
export type MockExercise = MockDb['exercises'][number];

export interface MockContext {
  genId: (prefix: string) => Id;
  now: () => Date;
  /** Réseau simulé : hors ligne, les envois de performances échouent en `NetworkError` (démo de la file). */
  isOnline: () => boolean;
  /** Lit la base (seed si absente, invalide ou d'une autre version). */
  read: () => MockDb;
  /** Applique `fn` sur une copie fraîche puis persiste. */
  write: <T>(fn: (db: MockDb) => T) => T;
  reset: () => void;
}

/** Exécute `fn` en asynchrone : une exception devient un rejet (même contrat que Supabase). */
export function task<T>(fn: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(fn());
  });
}

export interface MockOptions { genId?: (prefix: string) => Id; now?: () => Date; isOnline?: () => boolean }

const browserOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine;

function defaultGenId(prefix: string): Id {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  return uuid ?? `${prefix}_${String(Date.now())}_${Math.random().toString(16).slice(2)}`;
}

export function createMockContext(storage: Storage, opts: MockOptions = {}): MockContext {
  const genId = opts.genId ?? defaultGenId;
  const now = opts.now ?? (() => new Date());
  const isOnline = opts.isOnline ?? browserOnline;

  const persist = (db: MockDb): void => {
    storage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify({ ...db, updatedAt: now().toISOString() }));
  };

  const seed = (): MockDb => {
    const db = buildSeed(genId, now().toISOString());
    persist(db);
    return db;
  };

  const read = (): MockDb => {
    const raw = storage.getItem(MOCK_DB_STORAGE_KEY);
    if (!raw) return seed();
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn('[mock] Base locale illisible (JSON invalide) : réinitialisée avec le seed.');
      return seed();
    }
    const parsed = mockDbSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    console.warn("[mock] Base locale invalide ou d'une autre version : réinitialisée avec le seed.");
    return seed();
  };

  return {
    genId,
    now,
    isOnline,
    read,
    write(fn) {
      const db = read();
      const out = fn(db);
      persist(db);
      return out;
    },
    reset() {
      storage.removeItem(MOCK_DB_STORAGE_KEY);
      seed();
    },
  };
}
