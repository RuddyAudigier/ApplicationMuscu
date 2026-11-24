import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNative: vi.fn(() => false),
  share: vi.fn(),
  writeFile: vi.fn(),
  getUri: vi.fn(),
  deleteFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNative } }));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: mocks.writeFile, getUri: mocks.getUri, deleteFile: mocks.deleteFile, readdir: mocks.readdir },
}));

import { shareFile } from '@/platform/share';

const file = new File(['%PDF'], 'compte-rendu-a1-2026-11-23.pdf', { type: 'application/pdf' });
const meta = { title: 'CR', text: 'Texte', dialogTitle: 'Envoyer au coach' };

function setWebShare(share: unknown, canShare?: unknown): void {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });
}

function nativeOk(): void {
  mocks.isNative.mockReturnValue(true);
  mocks.writeFile.mockResolvedValue({ uri: 'x' });
  mocks.getUri.mockResolvedValue({ uri: 'file:///cr.pdf' });
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.readdir.mockResolvedValue({ files: [] });
}

describe('shareFile', () => {
  let anchors: HTMLAnchorElement[] = [];
  const revoke = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

  beforeEach(() => {
    vi.resetAllMocks();
    anchors = [];
    mocks.isNative.mockReturnValue(false);
    setWebShare(undefined);
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = revoke;
    click.mockImplementation(function (this: HTMLAnchorElement) {
      anchors.push(this);
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  afterAll(() => {
    click.mockRestore();
  });

  it('shares natively with the given dialog title and keeps the shared file', async () => {
    nativeOk();
    mocks.share.mockResolvedValue({});
    expect(await shareFile(file, meta)).toBe('shared');
    expect(mocks.share).toHaveBeenCalledWith({ title: 'CR', text: 'Texte', url: 'file:///cr.pdf', dialogTitle: 'Envoyer au coach' });
    const written = mocks.writeFile.mock.calls[0]?.[0] as { path: string };
    // L'appli cible peut lire l'URI après la résolution de Share.share : pas de suppression immédiate.
    expect(mocks.deleteFile).not.toHaveBeenCalledWith(expect.objectContaining({ path: written.path }));
    expect(anchors).toHaveLength(0);
  });

  it('purges shared files older than 1 hour before writing, ignoring errors', async () => {
    nativeOk();
    const now = Date.now();
    mocks.readdir.mockResolvedValue({
      files: [
        { name: 'old.pdf', type: 'file', mtime: now - 2 * 3600_000 },
        { name: 'locked.png', type: 'file', mtime: now - 3 * 3600_000 },
        { name: 'recent.pdf', type: 'file', mtime: now - 10 * 60_000 },
        { name: 'sub', type: 'directory', mtime: now - 5 * 3600_000 },
      ],
    });
    mocks.deleteFile.mockImplementation(({ path }: { path: string }) =>
      path.endsWith('locked.png') ? Promise.reject(new Error('busy')) : Promise.resolve(),
    );
    mocks.share.mockResolvedValue({});
    expect(await shareFile(file, meta)).toBe('shared');
    expect(mocks.readdir).toHaveBeenCalledWith({ path: 'shares', directory: 'CACHE' });
    const deleted = mocks.deleteFile.mock.calls.map((c) => (c[0] as { path: string }).path);
    expect(deleted).toEqual(['shares/old.pdf', 'shares/locked.png']);
    expect(mocks.deleteFile.mock.invocationCallOrder[0]).toBeLessThan(mocks.writeFile.mock.invocationCallOrder[0] ?? 0);
  });

  it('still shares when the shares folder cannot be listed', async () => {
    nativeOk();
    mocks.readdir.mockRejectedValue(new Error('Directory does not exist'));
    mocks.share.mockResolvedValue({});
    expect(await shareFile(file, { title: 'CR', text: 'T' })).toBe('shared');
    expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({ dialogTitle: 'CR' }));
  });

  it('stops on native cancel', async () => {
    nativeOk();
    mocks.share.mockRejectedValue(new Error('Share canceled'));
    const web = vi.fn();
    setWebShare(web, () => true);
    expect(await shareFile(file, meta)).toBe('cancelled');
    expect(web).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(0);
  });

  it('throws on other native errors instead of a no-op download in the WebView', async () => {
    nativeOk();
    mocks.share.mockRejectedValue(new Error('activity failed'));
    const web = vi.fn();
    setWebShare(web, () => true);
    await expect(shareFile(file, meta)).rejects.toThrow('activity failed');
    expect(web).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(0);
  });

  it('uses web share with files when canShare accepts them', async () => {
    const web = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);
    setWebShare(web, canShare);
    expect(await shareFile(file, meta)).toBe('shared');
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
    expect(web).toHaveBeenCalledWith({ title: 'CR', text: 'Texte', files: [file] });
  });

  it('downloads when canShare refuses files or is missing', async () => {
    const web = vi.fn();
    setWebShare(web, () => false);
    expect(await shareFile(file, meta)).toBe('downloaded');
    setWebShare(web);
    expect(await shareFile(file, meta)).toBe('downloaded');
    expect(web).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(2);
  });

  it('web share abort is cancelled', async () => {
    setWebShare(vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), () => true);
    expect(await shareFile(file, meta)).toBe('cancelled');
    expect(anchors).toHaveLength(0);
  });

  it('downloads when web share fails', async () => {
    setWebShare(vi.fn().mockRejectedValue(new TypeError('files unsupported')), () => true);
    expect(await shareFile(file, meta)).toBe('downloaded');
    expect(anchors).toHaveLength(1);
  });

  it('downloads when no share API exists, then revokes the URL', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    expect(await shareFile(file, meta)).toBe('downloaded');
    const a = anchors[0];
    expect(a?.download).toBe('compte-rendu-a1-2026-11-23.pdf');
    expect(a?.href).toBe('blob:pdf');
    expect(a?.isConnected).toBe(false);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:pdf');
  });
});
