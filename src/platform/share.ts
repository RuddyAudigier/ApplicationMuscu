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

async function nativeShare(file: File, meta: { title: string; text: string }): Promise<void> {
  const path = `shares/${String(Date.now())}-${file.name}`;
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(file),
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ title: meta.title, text: meta.text, url: uri, dialogTitle: 'Partager la séance' });
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
