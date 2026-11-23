import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyImage } from '@/platform/clipboard';

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

function setup(write: unknown, item: unknown = FakeClipboardItem): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: write ? { write } : undefined,
    configurable: true,
  });
  vi.stubGlobal('ClipboardItem', item);
}

function writtenItem(write: ReturnType<typeof vi.fn>): FakeClipboardItem | undefined {
  return (write.mock.calls[0] as [FakeClipboardItem[]] | undefined)?.[0][0];
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('copyImage', () => {
  it('writes png blob directly', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setup(write);
    const blob = new Blob(['a'], { type: 'image/png' });
    expect(await copyImage(blob)).toBe(true);
    expect(writtenItem(write)?.items['image/png']).toBe(blob);
  });

  it('copyImage converts jpeg to png', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setup(write);
    const png = new Blob(['p'], { type: 'image/png' });
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4, height: 3, close: vi.fn() }));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => {
      expect(type).toBe('image/png');
      cb(png);
    });
    expect(await copyImage(new Blob(['j'], { type: 'image/jpeg' }))).toBe(true);
    expect(drawImage).toHaveBeenCalled();
    expect(writtenItem(write)?.items['image/png']).toBe(png);
  });

  it('returns false when API missing or throws', async () => {
    const blob = new Blob(['a'], { type: 'image/png' });
    setup(undefined);
    expect(await copyImage(blob)).toBe(false);
    setup(vi.fn().mockResolvedValue(undefined), null);
    expect(await copyImage(blob)).toBe(false);
    setup(vi.fn().mockRejectedValue(new Error('denied')));
    expect(await copyImage(blob)).toBe(false);
  });
});
