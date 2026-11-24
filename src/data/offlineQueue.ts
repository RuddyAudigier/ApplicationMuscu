import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { PerformanceInput } from '../domain/model';
import { useBackend } from './context';
import { BackendError, NetworkError, ValidationError, type PerformancesRepo } from './ports';
import { queryKeys } from './queries/keys';
import { appendToArchive, archiveCount } from './shared/storage';

/** Même clé et même format que l'ancienne app (INV §3.17) : les files existantes sont reprises. */
export const OFFLINE_QUEUE_KEY = 'pending_performances_queue_v1';
/** Lots archivés (raison `rejected` | `uncertain` | `stuck`), conservés pour action manuelle. Ajout en fin. */
export const OFFLINE_QUEUE_FAILED_KEY = `${OFFLINE_QUEUE_KEY}_failed`;
/** Contenus illisibles de la file, conservés tels quels (chaînes brutes). Ajout en fin. */
export const OFFLINE_QUEUE_CORRUPT_KEY = `${OFFLINE_QUEUE_KEY}_corrupt`;

/** `attempts` : échecs transitoires déjà subis (absent = 0). */
interface QueuedBatch { createdAt: string; payload: PerformanceInput[]; attempts?: number }

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

const queueSchema = z.array(z.looseObject({
  createdAt: z.string().catch(''),
  payload: z.array(z.unknown()).catch([]),
  attempts: z.number().int().nonnegative().optional().catch(undefined),
}));

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
const UNCERTAIN_STATUS: readonly number[] = [502, 504];
/** Échecs transitoires (hors `NetworkError`) tolérés avant de déclarer un lot « bloqué ». */
export const MAX_ATTEMPTS = 5;

/** Raison d'archivage dans `OFFLINE_QUEUE_FAILED_KEY`. */
export type FailedReason = 'rejected' | 'uncertain' | 'stuck';
type Outcome = FailedReason | 'transient' | 'network';

/**
 * Classe un échec d'envoi :
 * - `network` : `NetworkError` (requête non partie, hors-ligne) → gardé, ne compte PAS comme essai ;
 * - `uncertain` : HTTP 502/504 → l'insert a pu être validé ; le rejouer risquerait un doublon :
 *   archivé, jamais rejoué ;
 * - `rejected` (définitif) : `ValidationError` locale, HTTP 400/404/409/422, ou code Postgres de
 *   donnée/contrainte (`22xxx`, `23xxx`). Le code prime sur le statut (23505 avec 500 → définitif) ;
 * - `transient` : tout le reste (status 0, 401/403, 429, autres 5xx, erreur inconnue) → gardé,
 *   compte comme un essai.
 */
function classify(e: unknown): Outcome {
  if (e instanceof NetworkError) return 'network';
  if (e instanceof ValidationError) return 'rejected';
  if (!(e instanceof BackendError)) return 'transient';
  if (e.code !== undefined && /^2[23]/.test(e.code)) return 'rejected';
  if (e.status !== undefined && UNCERTAIN_STATUS.includes(e.status)) return 'uncertain';
  if (e.status !== undefined && DEFINITIVE_STATUS.includes(e.status)) return 'rejected';
  return 'transient';
}

/** Ajoute le lot à l'archive PUIS le retire de la file (si l'ajout échoue, il reste en file). */
function archive(storage: Storage, batch: QueuedBatch, reason: FailedReason, e: unknown, attempts?: number): void {
  appendToArchive(storage, OFFLINE_QUEUE_FAILED_KEY, {
    ...batch, ...(attempts === undefined ? {} : { attempts }), reason, error: e instanceof Error ? e.message : String(e), failedAt: new Date().toISOString(),
  });
  removeBatch(storage, batch);
}

/** Remplace `batch` par `next` à la même place (ordre conservé). */
function replaceBatch(storage: Storage, batch: QueuedBatch, next: QueuedBatch): void {
  const queue = parseQueue(storage.getItem(OFFLINE_QUEUE_KEY));
  if (queue === null) throw new Error('File de performances devenue illisible pendant l’envoi.');
  const i = queue.findIndex((q) => sameBatch(q, batch));
  if (i >= 0) writeQueue(storage, [...queue.slice(0, i), next, ...queue.slice(i + 1)]);
}

/**
 * Pour chaque lot, dans l'ordre de la file :
 * 1. lot vide (ancienne app) → retiré ;
 * 2. envoi ; succès → retiré de la file AVANT le lot suivant (jamais renvoyé en double) ;
 * 3. `network` → ARRÊT : ce lot et les suivants restent en file, dans le même ordre ;
 * 4. `transient` → `attempts + 1` (même place dans la file) puis ARRÊT ; au 5e échec
 *    (`MAX_ATTEMPTS`) le lot est archivé `stuck` et les suivants sont envoyés (pas de blocage) ;
 * 5. `rejected` / `uncertain` → archivé avec cette raison, les suivants continuent.
 * Archivage : le lot est d'abord AJOUTÉ à `OFFLINE_QUEUE_FAILED_KEY`, puis seulement retiré de
 * la file ; si l'ajout échoue, le flush rejette et le lot reste en file.
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
      const outcome = classify(e);
      if (outcome === 'network') break;
      if (outcome === 'transient') {
        const attempts = (batch.attempts ?? 0) + 1;
        if (attempts < MAX_ATTEMPTS) {
          replaceBatch(storage, batch, { ...batch, attempts });
          break;
        }
        archive(storage, batch, 'stuck', e, attempts);
        failed += 1;
        continue;
      }
      archive(storage, batch, outcome, e);
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
