import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './native';

export type ShareResult = 'shared' | 'cancelled' | 'unavailable';

function isCancel(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /cancel/i.test(error.message);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const parts = result.split(',');
      const data = parts[1];
      if (data === undefined) reject(new Error('Conversion base64 invalide'));
      else resolve(data);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Erreur lecture blob'));
    };
    reader.readAsDataURL(blob);
  });
}

const SHARES_DIR = 'shares';
/** Âge au-delà duquel un fichier partagé est purgé du cache. */
const SHARE_TTL_MS = 60 * 60 * 1000;

/** Supprime les fichiers partagés de plus d'une heure ; toute erreur est ignorée. */
async function pruneSharedFiles(now: number = Date.now()): Promise<void> {
  try {
    const { files } = await Filesystem.readdir({ path: SHARES_DIR, directory: Directory.Cache });
    for (const f of files) {
      if (f.type !== 'file' || now - f.mtime <= SHARE_TTL_MS) continue;
      try {
        await Filesystem.deleteFile({ path: `${SHARES_DIR}/${f.name}`, directory: Directory.Cache });
      } catch {
        // fichier verrouillé ou déjà supprimé : on passe au suivant
      }
    }
  } catch {
    // dossier absent (premier partage) ou plugin indisponible
  }
}

async function nativeShare(
  file: File,
  meta: { title: string; text: string },
  dialogTitle = 'Partager la séance',
): Promise<void> {
  await pruneSharedFiles();
  const path = `${SHARES_DIR}/${String(Date.now())}-${file.name}`;
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(file),
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  // Pas de suppression ici : Share.share peut se résoudre avant que l'appli cible
  // (Gmail…) ait lu l'URI ; le fichier est purgé lors d'un partage ultérieur.
  await Share.share({ title: meta.title, text: meta.text, url: uri, dialogTitle });
}

export async function shareImage(
  file: File,
  meta: { title: string; text: string },
): Promise<ShareResult> {
  if (isNative()) {
    try {
      await nativeShare(file, meta);
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
    }
  }
  // Pas de canShare : il renvoie false à tort sur certains appareils.
  if (typeof navigator.share !== 'function') return 'unavailable';
  try {
    await navigator.share({ title: meta.title, text: meta.text, files: [file] });
    return 'shared';
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'unavailable';
  }
}

export type ShareFileResult = 'shared' | 'cancelled' | 'downloaded';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Laisse au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Partage un fichier (PDF…).
 * - Natif (Capacitor) : partage système ; une erreur autre qu'une annulation est relancée
 *   (un `<a download>` ne fait rien dans la WebView : pas de faux succès).
 * - Web : Web Share avec fichiers si `canShare` l'accepte, sinon téléchargement direct.
 * Une annulation par l'utilisateur arrête la chaîne.
 */
export async function shareFile(
  file: File,
  meta: { title: string; text: string; dialogTitle?: string },
): Promise<ShareFileResult> {
  if (isNative()) {
    try {
      await nativeShare(file, meta, meta.dialogTitle ?? meta.title);
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
      throw error;
    }
  }
  const canShareFiles =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });
  if (canShareFiles) {
    try {
      await navigator.share({ title: meta.title, text: meta.text, files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }
  download(file);
  return 'downloaded';
}
