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
  sessions: z.record(z.string(), cycleId).catch({}),
  state: stateSchema.nullable().catch(null),
});
type FallbackFile = z.infer<typeof fileSchema>;

export interface CycleFallback {
  /** Signale (une seule fois par backend) que la migration n'est pas jouée. */
  warn(): void;
  sessionCycle(id: Id): CycleId | null;
  setSessionCycle(id: Id, cycle: CycleId | null): void;
  state(): CycleState | null;
  setState(s: CycleState): void;
}

export function createCycleFallback(storage: Storage): CycleFallback {
  let warned = false;

  const read = (): FallbackFile => {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = fileSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      }
    } catch {
      // Stockage indisponible ou JSON illisible : on repart d'un fichier vide.
    }
    return { sessions: {}, state: null };
  };

  const write = (fn: (f: FallbackFile) => void): void => {
    const f = read();
    fn(f);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(f));
    } catch {
      // Stockage plein ou refusé : la valeur reste valable pour cette session uniquement côté serveur.
    }
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
