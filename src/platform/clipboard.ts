async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((png) => {
      if (png) resolve(png);
      else reject(new Error('Conversion PNG impossible'));
    }, 'image/png');
  });
}

export async function copyImage(blob: Blob): Promise<boolean> {
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (typeof clipboard?.write !== 'function' || typeof ClipboardItem !== 'function') {
    return false;
  }
  try {
    const png = await toPng(blob);
    await clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}
