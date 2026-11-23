import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNative: vi.fn(() => false),
  share: vi.fn(),
  writeFile: vi.fn(),
  getUri: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNative } }));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: mocks.writeFile, getUri: mocks.getUri },
}));

import { shareFile } from '@/platform/share';

const file = new File(['%PDF'], 'compte-rendu-a1-2026-11-23.pdf', { type: 'application/pdf' });
const meta = { title: 'CR', text: 'Texte', dialogTitle: 'Envoyer au coach' };

function setWebShare(value: unknown): void {
  Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true });
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

  it('shares natively with the given dialog title', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.writeFile.mockResolvedValue({ uri: 'x' });
    mocks.getUri.mockResolvedValue({ uri: 'file:///cr.pdf' });
    mocks.share.mockResolvedValue({});
    expect(await shareFile(file, meta)).toBe('shared');
    expect(mocks.share).toHaveBeenCalledWith({ title: 'CR', text: 'Texte', url: 'file:///cr.pdf', dialogTitle: 'Envoyer au coach' });
    expect(anchors).toHaveLength(0);
  });

  it('defaults the native dialog title to the title', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.writeFile.mockResolvedValue({ uri: 'x' });
    mocks.getUri.mockResolvedValue({ uri: 'u' });
    mocks.share.mockResolvedValue({});
    await shareFile(file, { title: 'CR', text: 'T' });
    expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({ dialogTitle: 'CR' }));
  });

  it('stops on native cancel', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.writeFile.mockResolvedValue({ uri: 'x' });
    mocks.getUri.mockResolvedValue({ uri: 'u' });
    mocks.share.mockRejectedValue(new Error('Share canceled'));
    const web = vi.fn();
    setWebShare(web);
    expect(await shareFile(file, meta)).toBe('cancelled');
    expect(web).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(0);
  });

  it('falls back from native error to web share with files', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.writeFile.mockRejectedValue(new Error('disk'));
    const web = vi.fn().mockResolvedValue(undefined);
    setWebShare(web);
    expect(await shareFile(file, meta)).toBe('shared');
    expect(web).toHaveBeenCalledWith({ title: 'CR', text: 'Texte', files: [file] });
  });

  it('web share abort is cancelled', async () => {
    setWebShare(vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })));
    expect(await shareFile(file, meta)).toBe('cancelled');
    expect(anchors).toHaveLength(0);
  });

  it('downloads when web share fails', async () => {
    setWebShare(vi.fn().mockRejectedValue(new TypeError('files unsupported')));
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
