import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import type { PerformanceInput } from '../domain/model';
import { useBackend } from './context';
import { NetworkError, type PerformancesRepo } from './ports';
import { queryKeys } from './queries/keys';

/** Même clé et même format que l'ancienne app (INV §3.17) : les files existantes sont reprises. */
export const OFFLINE_QUEUE_KEY = 'pending_performances_queue_v1';
const CORRUPT_KEY = `${OFFLINE_QUEUE_KEY}_corrupt`;

interface QueuedBatch { createdAt: string; payload: PerformanceInput[] }

const queueSchema = z.array(z.looseObject({ createdAt: z.string().catch(''), payload: z.array(z.unknown()).catch([]) }));

/** `null` = contenu illisible (laissé en place, jamais écrasé silencieusement). */
function read(storage: Storage): QueuedBatch[] | null {
  let raw: string | null;
  try {
    raw = storage.getItem(OFFLINE_QUEUE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = queueSchema.safeParse(JSON.parse(raw));
    // Le contenu des lots est validé par le repo à l'envoi (mêmes règles qu'en ligne).
    if (parsed.success) return parsed.data as QueuedBatch[];
  } catch {
    // JSON invalide : signalé ci-dessous.
  }
  console.error('[offline] File de performances en attente illisible : conservée telle quelle.');
  return null;
}

function write(storage: Storage, queue: QueuedBatch[]): void {
  try {
    if (queue.length === 0) storage.removeItem(OFFLINE_QUEUE_KEY);
    else storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[offline] Écriture de la file impossible :', e);
  }
}

/** Ajoute un lot à la file (uniquement après une `NetworkError`, D8). */
export function enqueue(inputs: PerformanceInput[], storage: Storage = localStorage, now: Date = new Date()): void {
  let queue = read(storage);
  if (queue === null) {
    // File illisible : mise de côté pour ne pas perdre le nouveau lot.
    try {
      storage.setItem(CORRUPT_KEY, storage.getItem(OFFLINE_QUEUE_KEY) ?? '');
    } catch {
      // Ignoré : le nouveau lot est écrit quand même.
    }
    queue = [];
  }
  write(storage, [...queue, { createdAt: now.toISOString(), payload: inputs }]);
}

/** Nombre de lots en attente d'envoi. */
export function pendingCount(storage: Storage = localStorage): number {
  return read(storage)?.length ?? 0;
}

const sameBatch = (a: QueuedBatch, b: QueuedBatch): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Retire `batch` de la file relue (des lots ont pu être ajoutés pendant l'envoi). */
function removeBatch(storage: Storage, batch: QueuedBatch): void {
  const queue = read(storage);
  if (!queue) return;
  const i = queue.findIndex((q) => sameBatch(q, batch));
  if (i >= 0) write(storage, [...queue.slice(0, i), ...queue.slice(i + 1)]);
}

interface FlushResult { sent: number; remaining: number }

async function flushOnce(repo: PerformancesRepo, storage: Storage): Promise<FlushResult> {
  const snapshot = read(storage);
  if (snapshot === null) return { sent: 0, remaining: 0 };
  let sent = 0;
  for (const batch of snapshot) {
    if (batch.payload.length === 0) {
      removeBatch(storage, batch);
      continue;
    }
    try {
      await repo.add(batch.payload);
    } catch (e) {
      if (e instanceof NetworkError) break; // toujours hors-ligne : inutile d'essayer les suivants
      continue; // lot refusé : conservé (aucune perte), réessayé au prochain flush
    }
    // Retiré dès le succès, avant le lot suivant : jamais renvoyé en double.
    removeBatch(storage, batch);
    sent += 1;
  }
  return { sent, remaining: read(storage)?.length ?? 0 };
}

const inFlight = new WeakMap<Storage, Promise<FlushResult>>();

/**
 * Envoie les lots dans l'ordre. Les lots en échec restent ; une `NetworkError` arrête l'envoi.
 * Deux appels simultanés partagent le même envoi (pas de doublon montage + `online`).
 */
export function flush(repo: PerformancesRepo, storage: Storage = localStorage): Promise<FlushResult> {
  const running = inFlight.get(storage);
  if (running) return running;
  const p = flushOnce(repo, storage).finally(() => {
    inFlight.delete(storage);
  });
  inFlight.set(storage, p);
  return p;
}

/** Rejoue la file au montage et à chaque retour en ligne ; recharge les performances si envoi. */
export function useOfflineQueueSync(): void {
  const { performances } = useBackend();
  const client = useQueryClient();
  useEffect(() => {
    const sync = (): void => {
      void flush(performances).then(({ sent }) => {
        if (sent > 0) void client.invalidateQueries({ queryKey: queryKeys.performances });
      });
    };
    sync();
    window.addEventListener('online', sync);
    return () => {
      window.removeEventListener('online', sync);
    };
  }, [performances, client]);
}
