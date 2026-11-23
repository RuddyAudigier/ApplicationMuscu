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

async function nativeShare(
  file: File,
  meta: { title: string; text: string },
  dialogTitle = 'Partager la séance',
): Promise<void> {
  const path = `shares/${String(Date.now())}-${file.name}`;
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(file),
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
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
 * Partage un fichier (PDF…) : partage natif Capacitor, puis Web Share (fichiers),
 * puis téléchargement direct. Une annulation par l'utilisateur arrête la chaîne.
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
    }
  }
  // Pas de canShare : il renvoie false à tort sur certains appareils.
  if (typeof navigator.share === 'function') {
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
