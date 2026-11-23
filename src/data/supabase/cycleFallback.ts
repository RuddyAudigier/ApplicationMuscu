import { z } from 'zod';
import type { CycleId, CycleState, Id } from '../../domain/model';

/** Repli local tant que `scripts/sql/2026-11-23_cycles.sql` n'est pas joué (Task 21). */
const STORAGE_KEY = 'mymuscle_cycles_v1';

const cycleId = z.enum(['A', 'B']);
const stateSchema = z.object({
  current: cycleId,
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks: z.union([z.literal(2), z.literal(3)]),
});
const fileSchema = z.object({
  sessions: z.record(z.string(), z.unknown()).catch({}),
  state: stateSchema.nullable().catch(null),
});
interface FallbackFile { sessions: Record<Id, CycleId>; state: CycleState | null }

export interface CycleFallback {
  /** Signale (une seule fois par backend) que la migration n'est pas jouée. */
  warn(): void;
  sessionCycle(id: Id): CycleId | null;
  /** Lève si le stockage refuse l'écriture (pas de perte silencieuse). */
  setSessionCycle(id: Id, cycle: CycleId | null): void;
  state(): CycleState | null;
  /** Lève si le stockage refuse l'écriture (pas de perte silencieuse). */
  setState(s: CycleState): void;
}

/** Seules les entrées invalides sont ignorées, pas toute la table. */
function parse(raw: string | null): FallbackFile {
  if (!raw) return { sessions: {}, state: null };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { sessions: {}, state: null };
  }
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) return { sessions: {}, state: null };
  const sessions: Record<Id, CycleId> = {};
  for (const [id, value] of Object.entries(parsed.data.sessions)) {
    const c = cycleId.safeParse(value);
    if (c.success) sessions[id] = c.data;
  }
  return { sessions, state: parsed.data.state };
}

export function createCycleFallback(storage: Storage): CycleFallback {
  let warned = false;

  /** Lecture tolérante (affichage) : stockage indisponible → vide. */
  const read = (): FallbackFile => {
    try {
      return parse(storage.getItem(STORAGE_KEY));
    } catch {
      return { sessions: {}, state: null };
    }
  };

  /** Écriture stricte : toute erreur de stockage remonte à l'appelant. */
  const write = (fn: (f: FallbackFile) => void): void => {
    const f = parse(storage.getItem(STORAGE_KEY));
    fn(f);
    storage.setItem(STORAGE_KEY, JSON.stringify(f));
  };

  return {
    warn() {
      if (warned) return;
      warned = true;
      console.warn(
        '[data] Migration cycles absente (scripts/sql/2026-11-23_cycles.sql non jouée) : '
        + 'les cycles sont enregistrés sur cet appareil uniquement.',
      );
    },
    sessionCycle: (id) => read().sessions[id] ?? null,
    setSessionCycle(id, cycle) {
      if (cycle === null && read().sessions[id] === undefined) return;
      write((f) => {
        if (cycle === null) {
          f.sessions = Object.fromEntries(Object.entries(f.sessions).filter(([k]) => k !== id));
        } else {
          f.sessions[id] = cycle;
        }
      });
    },
    state: () => read().state,
    setState(s) {
      write((f) => {
        f.state = { current: s.current, startedOn: s.startedOn, weeks: s.weeks };
      });
    },
  };
}
