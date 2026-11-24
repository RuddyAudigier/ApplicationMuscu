import type { FlushResult } from '@/data/queries';
import type { ToastKind } from '@/ui';

export const plural = (n: number, one: string, many: string): string => `${String(n)} ${n > 1 ? many : one}`;

/** Message de fin de synchro manuelle ; `success` seulement si tout est parti sans refus. */
export function syncMessage(r: FlushResult): { text: string; kind: ToastKind } {
  if (r.corrupt) return { text: 'File d’attente illisible : rien n’a été envoyé.', kind: 'error' };
  const parts: string[] = [];
  if (r.sent > 0) parts.push(`${plural(r.sent, 'lot envoyé', 'lots envoyés')}.`);
  if (r.failed > 0) parts.push(`${plural(r.failed, 'lot refusé', 'lots refusés')} : archivé sur l’appareil.`);
  if (r.remaining > 0) {
    parts.push(r.sent === 0 && r.failed === 0
      ? 'Rien n’a pu être envoyé : connexion ou serveur indisponible. Les données restent en attente sur cet appareil.'
      : `${plural(r.remaining, 'lot', 'lots')} encore en attente.`);
  }
  if (parts.length === 0) return { text: 'Rien à envoyer.', kind: 'info' };
  let kind: ToastKind = 'success';
  if (r.failed > 0 || r.sent === 0) kind = 'error';
  else if (r.remaining > 0) kind = 'info';
  return { text: parts.join(' '), kind };
}

/** `localStorage` ou `null` s'il est inaccessible (son accès peut lever une SecurityError). */
export function safeStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
