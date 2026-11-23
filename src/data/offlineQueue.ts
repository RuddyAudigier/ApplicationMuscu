import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { PerformanceInput } from '../domain/model';
import { useBackend } from './context';
import { BackendError, ValidationError, type PerformancesRepo } from './ports';
import { queryKeys } from './queries/keys';
import { appendToArchive, archiveCount } from './shared/storage';

/** Même clé et même format que l'ancienne app (INV §3.17) : les files existantes sont reprises. */
export const OFFLINE_QUEUE_KEY = 'pending_performances_queue_v1';
/** Lots refusés définitivement par le serveur, conservés pour action manuelle. Ajout en fin. */
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

export interface OfflineQueueStatus {
  /** Lots en attente (≥ 1 si la file est illisible). */
  pending: number;
  /** Lots à traiter à la main : refus définitifs + files illisibles archivées. */
  failed: number;
  /** La file courante est illisible. */
  corrupt: boolean;
}

/* ---------- Notification des changements (hook de statut) ---------- */

const listeners = new Set<() => void>();
const notify = (): void => {
  for (const l of listeners) l();
};

/* ---------- Lecture / écriture ---------- */

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
    appendToArchive(storage, OFFLINE_QUEUE_CORRUPT_KEY, raw);
    queue = [];
  }
  writeQueue(storage, [...queue, { createdAt: now.toISOString(), payload: inputs }]);
  notify();
}

/** Lots en attente d'envoi ; une file illisible compte pour au moins 1 (jamais « 0 » trompeur). */
export function pendingCount(storage: Storage = localStorage): number {
  return queueStatus(storage).pending;
}

/** Lots à traiter à la main : refus définitifs + files illisibles archivées. */
export function failedCount(storage: Storage = localStorage): number {
  return archiveCount(storage, OFFLINE_QUEUE_FAILED_KEY) + archiveCount(storage, OFFLINE_QUEUE_CORRUPT_KEY);
}

/** État complet de la file, en lecture tolérante (stockage indisponible → 0). */
export function queueStatus(storage: Storage = localStorage): OfflineQueueStatus {
  let queue: QueuedBatch[] | null;
  try {
    queue = parseQueue(storage.getItem(OFFLINE_QUEUE_KEY));
  } catch {
    queue = [];
  }
  return { pending: queue?.length ?? 1, failed: failedCount(storage), corrupt: queue === null };
}

const sameBatch = (a: QueuedBatch, b: QueuedBatch): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Retire `batch` de la file relue (des lots ont pu être ajoutés pendant l'envoi). */
function removeBatch(storage: Storage, batch: QueuedBatch): void {
  const queue = parseQueue(storage.getItem(OFFLINE_QUEUE_KEY));
  if (queue === null) throw new Error('File de performances devenue illisible pendant l’envoi.');
  const i = queue.findIndex((q) => sameBatch(q, batch));
  if (i >= 0) writeQueue(storage, [...queue.slice(0, i), ...queue.slice(i + 1)]);
}

/* ---------- Politique de rejeu ---------- */

const DEFINITIVE_STATUS: readonly number[] = [400, 404, 409, 422];

/**
 * Refus DÉFINITIF (archivé) : `ValidationError` locale, HTTP 400/404/409/422, ou code Postgres
 * de donnée/contrainte (classes `22xxx` et `23xxx`). Tout le reste est TRANSITOIRE (gardé) :
 * `NetworkError`, status 0, 401/403 (clé, RLS), 429, 5xx dont 502/504 incertains, erreur inconnue.
 * Le code Postgres prime sur le statut (ex. 23505 renvoyé avec 500 → définitif).
 */
function isDefinitiveRejection(e: unknown): boolean {
  if (e instanceof ValidationError) return true;
  if (!(e instanceof BackendError)) return false;
  if (e.code !== undefined && /^2[23]/.test(e.code)) return true;
  return e.status !== undefined && DEFINITIVE_STATUS.includes(e.status);
}

/**
 * Pour chaque lot, dans l'ordre de la file :
 * 1. lot vide (ancienne app) → retiré ;
 * 2. envoi ; succès → retiré de la file AVANT le lot suivant (jamais renvoyé en double) ;
 * 3. échec transitoire (voir `isDefinitiveRejection`) → ARRÊT : ce lot et les suivants restent en
 *    file, dans le même ordre, et seront rejoués au prochain flush (montage, `online`) ;
 * 4. refus définitif → le lot est d'abord AJOUTÉ à `OFFLINE_QUEUE_FAILED_KEY`, puis seulement
 *    retiré de la file ; si l'ajout échoue, le flush rejette et le lot reste en file. Les lots
 *    suivants continuent.
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
      if (!isDefinitiveRejection(e)) break;
      appendToArchive(storage, OFFLINE_QUEUE_FAILED_KEY, {
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
 * Envoie la file (ordre et politique détaillés sur `flushOnce`). Rejette sur erreur de stockage.
 * Deux appels simultanés partagent le même envoi (pas de doublon montage + `online`).
 */
export function flush(repo: PerformancesRepo, storage: Storage = localStorage): Promise<FlushResult> {
  const running = inFlight.get(storage);
  if (running) return running;
  const p = flushOnce(repo, storage).finally(() => {
    inFlight.delete(storage);
    notify();
  });
  inFlight.set(storage, p);
  return p;
}

/* ---------- Hooks ---------- */

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

const sameStatus = (a: OfflineQueueStatus, b: OfflineQueueStatus): boolean =>
  a.pending === b.pending && a.failed === b.failed && a.corrupt === b.corrupt;

/** État de la file (Réglages) : relu après chaque ajout / flush et sur l'événement `storage`. */
export function useOfflineQueueStatus(): OfflineQueueStatus {
  const [status, setStatus] = useState(() => queueStatus());
  useEffect(() => {
    const refresh = (): void => {
      const next = queueStatus();
      setStatus((prev) => (sameStatus(prev, next) ? prev : next));
    };
    refresh();
    listeners.add(refresh);
    window.addEventListener('storage', refresh);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return status;
}
