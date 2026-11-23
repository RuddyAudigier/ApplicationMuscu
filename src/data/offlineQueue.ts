import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import type { PerformanceInput } from '../domain/model';
import { useBackend } from './context';
import { NetworkError, type PerformancesRepo } from './ports';
import { queryKeys } from './queries/keys';

/** Même clé et même format que l'ancienne app (INV §3.17) : les files existantes sont reprises. */
export const OFFLINE_QUEUE_KEY = 'pending_performances_queue_v1';
/** Lots refusés par le serveur (hors panne réseau), conservés pour action manuelle. Ajout en fin. */
export const OFFLINE_QUEUE_FAILED_KEY = `${OFFLINE_QUEUE_KEY}_failed`;
/** Contenus illisibles de la file, conservés tels quels (chaînes brutes). Ajout en fin. */
export const OFFLINE_QUEUE_CORRUPT_KEY = `${OFFLINE_QUEUE_KEY}_corrupt`;

interface QueuedBatch { createdAt: string; payload: PerformanceInput[] }

export interface FlushResult {
  /** Lots envoyés pendant ce flush. */
  sent: number;
  /** Lots encore en file (≥ 1 si la file est illisible). */
  remaining: number;
  /** Lots déplacés vers `OFFLINE_QUEUE_FAILED_KEY` pendant ce flush. */
  failed: number;
  /** `true` si la file est illisible (laissée en place, rien n'est envoyé). */
  corrupt: boolean;
}

const queueSchema = z.array(z.looseObject({ createdAt: z.string().catch(''), payload: z.array(z.unknown()).catch([]) }));

/** `null` = contenu illisible. Le contenu des lots est validé par le repo à l'envoi. */
function parseQueue(raw: string | null): QueuedBatch[] | null {
  if (!raw) return [];
  try {
    const parsed = queueSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as QueuedBatch[]) : null;
  } catch {
    return null;
  }
}

/** Écriture stricte : une erreur de stockage remonte (jamais de perte silencieuse). */
function writeQueue(storage: Storage, queue: QueuedBatch[]): void {
  if (queue.length === 0) storage.removeItem(OFFLINE_QUEUE_KEY);
  else storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

/** Ajoute `item` en fin d'archive ; une archive illisible est gardée comme première entrée brute. */
function appendTo(storage: Storage, key: string, item: unknown): void {
  const raw = storage.getItem(key);
  let list: unknown[] = [];
  if (raw !== null) {
    try {
      const json: unknown = JSON.parse(raw);
      list = Array.isArray(json) ? json : [raw];
    } catch {
      list = [raw];
    }
  }
  storage.setItem(key, JSON.stringify([...list, item]));
}

/** Taille d'une archive en lecture tolérante (illisible = 1). */
function archiveCount(storage: Storage, key: string): number {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return 0;
    const json: unknown = JSON.parse(raw);
    return Array.isArray(json) ? json.length : 1;
  } catch {
    return 1;
  }
}

/**
 * Ajoute un lot à la file (uniquement après une `NetworkError`, D8).
 * Lève si le stockage est indisponible ou plein : l'appelant ne doit PAS annoncer « mis en file ».
 * File illisible : elle est d'abord ajoutée à `OFFLINE_QUEUE_CORRUPT_KEY` ; si cette sauvegarde
 * échoue, l'ajout est refusé (lève) et la file illisible reste intacte.
 */
export function enqueue(inputs: PerformanceInput[], storage: Storage = localStorage, now: Date = new Date()): void {
  const raw = storage.getItem(OFFLINE_QUEUE_KEY);
  let queue = parseQueue(raw);
  if (queue === null) {
    console.error('[offline] File de performances illisible : archivée sous', OFFLINE_QUEUE_CORRUPT_KEY);
    appendTo(storage, OFFLINE_QUEUE_CORRUPT_KEY, raw);
    queue = [];
  }
  writeQueue(storage, [...queue, { createdAt: now.toISOString(), payload: inputs }]);
}

/** Lots en attente d'envoi ; une file illisible compte pour au moins 1 (jamais « 0 » trompeur). */
export function pendingCount(storage: Storage = localStorage): number {
  try {
    return parseQueue(storage.getItem(OFFLINE_QUEUE_KEY))?.length ?? 1;
  } catch {
    return 0;
  }
}

/** Lots à traiter à la main : refusés par le serveur + files illisibles archivées. */
export function failedCount(storage: Storage = localStorage): number {
  return archiveCount(storage, OFFLINE_QUEUE_FAILED_KEY) + archiveCount(storage, OFFLINE_QUEUE_CORRUPT_KEY);
}

const sameBatch = (a: QueuedBatch, b: QueuedBatch): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Retire `batch` de la file relue (des lots ont pu être ajoutés pendant l'envoi). */
function removeBatch(storage: Storage, batch: QueuedBatch): void {
  const queue = parseQueue(storage.getItem(OFFLINE_QUEUE_KEY));
  if (queue === null) throw new Error('File de performances devenue illisible pendant l’envoi.');
  const i = queue.findIndex((q) => sameBatch(q, batch));
  if (i >= 0) writeQueue(storage, [...queue.slice(0, i), ...queue.slice(i + 1)]);
}

/**
 * Pour chaque lot, dans l'ordre de la file :
 * 1. lot vide (ancienne app) → retiré ;
 * 2. envoi ; succès → retiré de la file AVANT le lot suivant (jamais renvoyé en double) ;
 * 3. `NetworkError` → arrêt, ce lot et les suivants restent en file, dans le même ordre ;
 * 4. autre erreur (validation, contrainte, réponse perdue…) → le lot est d'abord AJOUTÉ à
 *    `OFFLINE_QUEUE_FAILED_KEY`, puis seulement retiré de la file ; si l'ajout échoue, le flush
 *    rejette et le lot reste en file. Les lots suivants continuent.
 */
async function flushOnce(repo: PerformancesRepo, storage: Storage): Promise<FlushResult> {
  const snapshot = parseQueue(storage.getItem(OFFLINE_QUEUE_KEY));
  if (snapshot === null) {
    console.error('[offline] File de performances illisible : conservée telle quelle, rien n’est envoyé.');
    return { sent: 0, remaining: 1, failed: 0, corrupt: true };
  }
  let sent = 0;
  let failed = 0;
  for (const batch of snapshot) {
    if (batch.payload.length === 0) {
      removeBatch(storage, batch);
      continue;
    }
    try {
      await repo.add(batch.payload);
    } catch (e) {
      if (e instanceof NetworkError) break;
      appendTo(storage, OFFLINE_QUEUE_FAILED_KEY, {
        ...batch, error: e instanceof Error ? e.message : String(e), failedAt: new Date().toISOString(),
      });
      removeBatch(storage, batch);
      failed += 1;
      continue;
    }
    removeBatch(storage, batch);
    sent += 1;
  }
  const rest = parseQueue(storage.getItem(OFFLINE_QUEUE_KEY));
  return { sent, remaining: rest?.length ?? 1, failed, corrupt: rest === null };
}

const inFlight = new WeakMap<Storage, Promise<FlushResult>>();

/**
 * Envoie la file (ordre détaillé sur `flushOnce`). Rejette sur erreur de stockage.
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
      flush(performances).then(({ sent }) => {
        if (sent > 0) void client.invalidateQueries({ queryKey: queryKeys.performances });
      }, (e: unknown) => {
        console.error('[offline] Synchronisation de la file impossible :', e);
      });
    };
    sync();
    window.addEventListener('online', sync);
    return () => {
      window.removeEventListener('online', sync);
    };
  }, [performances, client]);
}
