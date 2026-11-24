import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { PerformanceInput } from '../domain/model';
import { useBackend } from './context';
import { BackendError, NetworkError, ValidationError, type DataBackend, type PerformancesRepo } from './ports';
import { queryKeys } from './queries/keys';
import { appendToArchive, archiveCount } from './shared/storage';

/** Même clé et même format que l'ancienne app (INV §3.17) : les files existantes sont reprises. */
export const OFFLINE_QUEUE_KEY = 'pending_performances_queue_v1';
/** Lots archivés (raison `rejected` | `uncertain`), conservés pour action manuelle. Ajout en fin. */
export const OFFLINE_QUEUE_FAILED_KEY = `${OFFLINE_QUEUE_KEY}_failed`;
/** Contenus illisibles de la file, conservés tels quels (chaînes brutes). Ajout en fin. */
export const OFFLINE_QUEUE_CORRUPT_KEY = `${OFFLINE_QUEUE_KEY}_corrupt`;

/** Clés d'une file : file, archive des échecs, archive des contenus illisibles. */
export interface QueueKeys { queue: string; failed: string; corrupt: string }

const keysOf = (queue: string): QueueKeys => ({ queue, failed: `${queue}_failed`, corrupt: `${queue}_corrupt` });
/** File réelle (Supabase) : clés legacy, reprises telles quelles. */
export const SUPABASE_QUEUE_KEYS: QueueKeys = keysOf(OFFLINE_QUEUE_KEY);
/** File de démo (mock), préfixée : une réinitialisation mock ne touche jamais la vraie file. */
export const MOCK_QUEUE_KEYS: QueueKeys = keysOf(`mock:${OFFLINE_QUEUE_KEY}`);

export const queueKeysFor = (kind: DataBackend['kind']): QueueKeys => (kind === 'mock' ? MOCK_QUEUE_KEYS : SUPABASE_QUEUE_KEYS);

/**
 * `attempts` : échecs transitoires déjà subis (absent = 0). `lastError` : message du dernier.
 * `inFlight` : envoi commencé et pas encore conclu (marqué AVANT `repo.add`).
 */
interface QueuedBatch { createdAt: string; payload: PerformanceInput[]; attempts?: number; lastError?: string; inFlight?: boolean }

export interface FlushResult {
  /** Lots envoyés pendant ce flush. */
  sent: number;
  /** Lots encore en file (≥ 1 si la file est illisible). */
  remaining: number;
  /** Lots déplacés vers l'archive des échecs pendant ce flush. */
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
  /** Le premier lot échoue (erreur transitoire : droits, quota, serveur) : la file est arrêtée. */
  blocked: boolean;
  /** Message de ce dernier échec ; `null` si la file n'est pas bloquée. */
  lastError: string | null;
}

/* ---------- Notification des changements (hook de statut) ---------- */

const listeners = new Set<() => void>();
const notify = (): void => {
  for (const l of listeners) l();
};

/* ---------- Lecture / écriture ---------- */

/** `localStorage` par défaut, résolu à l'appel : son simple accès peut lever (SecurityError). */
function resolveStorage(storage: Storage | undefined): Storage {
  return storage ?? localStorage;
}

const queueSchema = z.array(z.looseObject({
  createdAt: z.string().catch(''),
  payload: z.array(z.unknown()).catch([]),
  attempts: z.number().int().nonnegative().optional().catch(undefined),
  lastError: z.string().optional().catch(undefined),
  inFlight: z.boolean().optional().catch(undefined),
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
function writeQueue(storage: Storage, keys: QueueKeys, queue: QueuedBatch[]): void {
  if (queue.length === 0) storage.removeItem(keys.queue);
  else storage.setItem(keys.queue, JSON.stringify(queue));
}

function readQueueStrict(storage: Storage, keys: QueueKeys): QueuedBatch[] {
  const queue = parseQueue(storage.getItem(keys.queue));
  if (queue === null) throw new Error('File de performances devenue illisible pendant l’envoi.');
  return queue;
}

/**
 * Ajoute un lot à la file (uniquement après une `NetworkError`, D8).
 * Lève si le stockage est indisponible ou plein : l'appelant ne doit PAS annoncer « mis en file ».
 * File illisible : elle est d'abord ajoutée à l'archive `corrupt` ; si cette sauvegarde
 * échoue, l'ajout est refusé (lève) et la file illisible reste intacte.
 */
export function enqueue(
  inputs: PerformanceInput[], storage?: Storage, now: Date = new Date(), keys: QueueKeys = SUPABASE_QUEUE_KEYS,
): void {
  const store = resolveStorage(storage);
  const raw = store.getItem(keys.queue);
  let queue = parseQueue(raw);
  if (queue === null) {
    console.error('[offline] File de performances illisible : archivée sous', keys.corrupt);
    appendToArchive(store, keys.corrupt, raw);
    queue = [];
  }
  writeQueue(store, keys, [...queue, { createdAt: now.toISOString(), payload: inputs }]);
  notify();
}

/** Lots en attente d'envoi ; une file illisible compte pour au moins 1 (jamais « 0 » trompeur). */
export function pendingCount(storage?: Storage, keys: QueueKeys = SUPABASE_QUEUE_KEYS): number {
  return queueStatus(storage, keys).pending;
}

/** Lots à traiter à la main : refus définitifs + files illisibles archivées. */
export function failedCount(storage?: Storage, keys: QueueKeys = SUPABASE_QUEUE_KEYS): number {
  return queueStatus(storage, keys).failed;
}

const EMPTY_STATUS: OfflineQueueStatus = { pending: 0, failed: 0, corrupt: false, blocked: false, lastError: null };

/** État complet de la file, en lecture tolérante (stockage indisponible → vide). */
export function queueStatus(storage?: Storage, keys: QueueKeys = SUPABASE_QUEUE_KEYS): OfflineQueueStatus {
  let store: Storage;
  let queue: QueuedBatch[] | null;
  try {
    store = resolveStorage(storage);
    queue = parseQueue(store.getItem(keys.queue));
  } catch {
    return EMPTY_STATUS;
  }
  const lastError = queue?.[0]?.lastError ?? null;
  return {
    pending: queue?.length ?? 1,
    failed: archiveCount(store, keys.failed) + archiveCount(store, keys.corrupt),
    corrupt: queue === null,
    blocked: lastError !== null,
    lastError,
  };
}

const sameBatch = (a: QueuedBatch, b: QueuedBatch): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Remplace `batch` par `next` (le retire si `null`) dans la file relue : des lots ont pu être ajoutés pendant l'envoi. */
function replaceBatch(storage: Storage, keys: QueueKeys, batch: QueuedBatch, next: QueuedBatch | null): void {
  const queue = readQueueStrict(storage, keys);
  const i = queue.findIndex((q) => sameBatch(q, batch));
  if (i >= 0) writeQueue(storage, keys, [...queue.slice(0, i), ...(next ? [next] : []), ...queue.slice(i + 1)]);
}

/* ---------- Politique de rejeu ---------- */

const DEFINITIVE_STATUS: readonly number[] = [400, 404, 409, 422];
const UNCERTAIN_STATUS: readonly number[] = [502, 504];

/** Raison d'archivage dans l'archive des échecs. */
export type FailedReason = 'rejected' | 'uncertain';
type Outcome = FailedReason | 'transient' | 'network';

/**
 * Classe un échec d'envoi :
 * - `network` : `NetworkError` (requête non partie, hors-ligne) → gardé, ne compte PAS comme essai ;
 * - `uncertain` : HTTP 502/504 → l'insert a pu être validé ; le rejouer risquerait un doublon :
 *   archivé, jamais rejoué ;
 * - `rejected` (définitif) : `ValidationError` locale, HTTP 400/404/409/422, ou code Postgres de
 *   donnée/contrainte (`22xxx`, `23xxx`). Le code prime sur le statut (23505 avec 500 → définitif) ;
 * - `transient` : tout le reste (status 0, 401/403, 429, autres 5xx, erreur inconnue) → gardé en
 *   tête de file, JAMAIS archivé : la file reste « bloquée » jusqu'à un essai réussi.
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

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Ajoute le lot à l'archive PUIS le retire de la file (si l'ajout échoue, il reste en file). */
function archive(storage: Storage, keys: QueueKeys, stored: QueuedBatch, reason: FailedReason, error: string): void {
  const batch: QueuedBatch = { ...stored };
  delete batch.inFlight;
  appendToArchive(storage, keys.failed, { ...batch, reason, error, failedAt: new Date().toISOString() });
  replaceBatch(storage, keys, stored, null);
}

const INTERRUPTED = 'Envoi interrompu avant confirmation : il a pu être enregistré.';

/**
 * Pour chaque lot, dans l'ordre de la file :
 * 1. lot vide (ancienne app) → retiré ;
 * 2. lot déjà marqué `inFlight` (envoi précédent interrompu) → archivé `uncertain`, jamais renvoyé ;
 * 3. marqué `inFlight` PUIS envoyé ; succès → retiré de la file AVANT le lot suivant ;
 * 4. `network` → ARRÊT : ce lot (sans marque) et les suivants restent en file, dans le même ordre ;
 * 5. `transient` → `attempts + 1` et `lastError` (même place) puis ARRÊT : jamais archivé ;
 * 6. `rejected` / `uncertain` → archivé avec cette raison, les suivants continuent.
 * Archivage : le lot est d'abord AJOUTÉ à l'archive, puis seulement retiré de la file ; si l'ajout
 * échoue, le flush rejette et le lot reste en file.
 */
async function flushOnce(repo: PerformancesRepo, storage: Storage, keys: QueueKeys): Promise<FlushResult> {
  const snapshot = parseQueue(storage.getItem(keys.queue));
  if (snapshot === null) {
    console.error('[offline] File de performances illisible : conservée telle quelle, rien n’est envoyé.');
    return { sent: 0, remaining: 1, failed: 0, corrupt: true };
  }
  let sent = 0;
  let failed = 0;
  for (const batch of snapshot) {
    if (batch.payload.length === 0) {
      replaceBatch(storage, keys, batch, null);
      continue;
    }
    if (batch.inFlight) {
      archive(storage, keys, batch, 'uncertain', INTERRUPTED);
      failed += 1;
      continue;
    }
    const sending: QueuedBatch = { ...batch, inFlight: true };
    replaceBatch(storage, keys, batch, sending);
    try {
      await repo.add(batch.payload);
    } catch (e) {
      const outcome = classify(e);
      if (outcome === 'network') {
        replaceBatch(storage, keys, sending, batch);
        break;
      }
      if (outcome === 'transient') {
        replaceBatch(storage, keys, sending, { ...batch, attempts: (batch.attempts ?? 0) + 1, lastError: messageOf(e) });
        break;
      }
      archive(storage, keys, sending, outcome, messageOf(e));
      failed += 1;
      continue;
    }
    replaceBatch(storage, keys, sending, null);
    sent += 1;
  }
  const rest = parseQueue(storage.getItem(keys.queue));
  return { sent, remaining: rest?.length ?? 1, failed, corrupt: rest === null };
}

const running = new WeakMap<Storage, Map<string, Promise<FlushResult>>>();

/**
 * Envoie la file (ordre et politique détaillés sur `flushOnce`). Rejette sur erreur de stockage.
 * Deux appels simultanés sur la même file partagent le même envoi (pas de doublon montage + `online`).
 */
export function flush(repo: PerformancesRepo, storage?: Storage, keys: QueueKeys = SUPABASE_QUEUE_KEYS): Promise<FlushResult> {
  let store: Storage;
  try {
    store = resolveStorage(storage);
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error(String(e)));
  }
  const byKey = running.get(store) ?? new Map<string, Promise<FlushResult>>();
  running.set(store, byKey);
  const current = byKey.get(keys.queue);
  if (current) return current;
  const p = flushOnce(repo, store, keys).finally(() => {
    byKey.delete(keys.queue);
    notify();
  });
  byKey.set(keys.queue, p);
  return p;
}

/**
 * Remet les lots archivés (échecs) en fin de file, sans leurs marques d'échec ; une entrée
 * illisible reste archivée. Renvoie le nombre de lots remis en file. Lève si le stockage refuse.
 */
export function resendArchived(storage?: Storage, keys: QueueKeys = SUPABASE_QUEUE_KEYS): number {
  const store = resolveStorage(storage);
  const raw = store.getItem(keys.failed);
  if (raw === null) return 0;
  let entries: unknown[];
  try {
    const json: unknown = JSON.parse(raw);
    entries = Array.isArray(json) ? json : [raw];
  } catch {
    entries = [raw];
  }
  const batches: QueuedBatch[] = [];
  const kept: unknown[] = [];
  for (const entry of entries) {
    const b = typeof entry === 'object' && entry !== null ? parseQueue(JSON.stringify([entry]))?.[0] : undefined;
    if (b && b.payload.length > 0) batches.push({ createdAt: b.createdAt, payload: b.payload });
    else kept.push(entry);
  }
  if (batches.length === 0) return 0;
  writeQueue(store, keys, [...readQueueStrict(store, keys), ...batches]);
  if (kept.length === 0) store.removeItem(keys.failed);
  else store.setItem(keys.failed, JSON.stringify(kept));
  notify();
  return batches.length;
}

/* ---------- Hooks ---------- */

/** Rejoue la file du backend courant au montage et à chaque retour en ligne ; recharge les performances si envoi. */
export function useOfflineQueueSync(): void {
  const { performances, kind } = useBackend();
  const client = useQueryClient();
  useEffect(() => {
    const sync = (): void => {
      flush(performances, undefined, queueKeysFor(kind)).then(({ sent }) => {
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
  }, [performances, kind, client]);
}

const sameStatus = (a: OfflineQueueStatus, b: OfflineQueueStatus): boolean =>
  a.pending === b.pending && a.failed === b.failed && a.corrupt === b.corrupt && a.lastError === b.lastError;

/** État de la file du backend courant (Réglages) : relu après chaque ajout / flush et sur l'événement `storage`. */
export function useOfflineQueueStatus(): OfflineQueueStatus {
  const keys = queueKeysFor(useBackend().kind);
  const [status, setStatus] = useState(() => queueStatus(undefined, keys));
  useEffect(() => {
    const refresh = (): void => {
      const next = queueStatus(undefined, keys);
      setStatus((prev) => (sameStatus(prev, next) ? prev : next));
    };
    refresh();
    listeners.add(refresh);
    window.addEventListener('storage', refresh);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [keys]);
  return status;
}
