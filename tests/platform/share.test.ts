import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { shareImage } from '@/platform/share';

const file = new File(['abc'], 'seance.png', { type: 'image/png' });
const meta = { title: 'T', text: 'X' };

function setWebShare(value: unknown): void {
  Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true });
}

describe('shareImage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isNative.mockReturnValue(false);
    setWebShare(undefined);
  });

  it('returns cancelled on native "Share canceled" and stops', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.writeFile.mockResolvedValue({ uri: 'x' });
    mocks.getUri.mockResolvedValue({ uri: 'file:///x' });
    mocks.share.mockRejectedValue(new Error('Share canceled'));
    const webShare = vi.fn();
    setWebShare(webShare);
    expect(await shareImage(file, meta)).toBe('cancelled');
    expect(webShare).not.toHaveBeenCalled();
  });

  it('shares natively via cache file', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.writeFile.mockResolvedValue({ uri: 'x' });
    mocks.getUri.mockResolvedValue({ uri: 'file:///x' });
    mocks.share.mockResolvedValue({});
    expect(await shareImage(file, meta)).toBe('shared');
    const arg = mocks.writeFile.mock.calls[0]?.[0] as { path: string; directory: string };
    expect(arg.path).toMatch(/^shares\/\d+-seance\.png$/);
    expect(arg.directory).toBe('CACHE');
    expect(mocks.share).toHaveBeenCalledWith({
      title: 'T',
      text: 'X',
      url: 'file:///x',
      dialogTitle: 'Partager la séance',
    });
  });

  it('falls back to web share on other native error', async () => {
    mocks.isNative.mockReturnValue(true);
    mocks.writeFile.mockRejectedValue(new Error('disk'));
    const webShare = vi.fn().mockResolvedValue(undefined);
    setWebShare(webShare);
    expect(await shareImage(file, meta)).toBe('shared');
    expect(webShare).toHaveBeenCalledWith({ title: 'T', text: 'X', files: [file] });
  });

  it('falls back to navigator.share when not native', async () => {
    const webShare = vi.fn().mockResolvedValue(undefined);
    setWebShare(webShare);
    expect(await shareImage(file, meta)).toBe('shared');
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it('web AbortError is cancelled; other error or missing is unavailable', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    setWebShare(vi.fn().mockRejectedValue(abort));
    expect(await shareImage(file, meta)).toBe('cancelled');
    setWebShare(vi.fn().mockRejectedValue(new Error('no')));
    expect(await shareImage(file, meta)).toBe('unavailable');
    setWebShare(undefined);
    expect(await shareImage(file, meta)).toBe('unavailable');
  });
});
