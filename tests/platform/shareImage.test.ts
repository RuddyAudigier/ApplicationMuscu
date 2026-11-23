import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderShareImage, type ShareImageModel } from '@/platform/shareImage';

function model(blocks: number, linesPer: number): ShareImageModel {
  return {
    title: 'Pecs',
    subtitle: 'Séance réalisée le 01/02/2026',
    summary: { improved: 1, equaled: 2, below: 3, dataCapture: 4 },
    blocks: Array.from({ length: blocks }, (_, i) => ({
      name: `Ex ${String(i)}`,
      lines: Array.from({ length: linesPer }, (_, j) => ({
        main: `S${String(j + 1)}: 10 reps x 50 kg`,
        bench: '▲ Record battu',
        status: 'improved' as const,
      })),
    })),
    footer: 'Partagé depuis Mon Carnet - 01/02 - PR-v10',
  };
}

interface Drawn { t: string; x: number; y: number; font: string; fill: string }

function mockCanvas(blob: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
  const calls: Drawn[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    fillRect: vi.fn(),
    fillText: vi.fn((t: string, x: number, y: number) => {
      calls.push({ t, x, y, font: ctx.font, fill: ctx.fillStyle });
    }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };
  const sizes: { w: number; h: number }[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    sizes.push({ w: this.width, h: this.height });
    return ctx as unknown as CanvasRenderingContext2D;
  });
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
    cb(blob);
  });
  return { calls, sizes, toBlob };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('renderShareImage', () => {
  it('renderShareImage height formula', async () => {
    const m = mockCanvas();
    await renderShareImage(model(2, 3), 'image/jpeg');
    expect(m.sizes[0]).toEqual({ w: 1200, h: Math.min(3600, Math.max(1400, 280 + 56 * 2 + 72 * 6 + 120)) });
    await renderShareImage(model(20, 5), 'image/png');
    expect(m.sizes[1]?.h).toBe(3600);
  });

  it('draws texts and encodes with quality 0.84', async () => {
    const m = mockCanvas();
    await renderShareImage(model(1, 1), 'image/jpeg');
    const texts = m.calls.map((c) => c.t);
    expect(texts).toContain('Pecs');
    expect(texts).toContain('▲ 1 améliorées');
    expect(texts).toContain('= 2 égalées');
    expect(texts).toContain('↘ 3 en-dessous');
    expect(texts).toContain('● 4 prises de données');
    expect(texts).toContain('• S1: 10 reps x 50 kg');
    expect(texts).toContain('  ▲ Record battu');
    const footer = m.calls.find((c) => c.t.startsWith('Partagé'));
    expect(footer).toMatchObject({ x: 64, y: 1400 - 26, font: '500 20px Arial', fill: '#64748b' });
    expect(m.toBlob.mock.calls[0]?.[1]).toBe('image/jpeg');
    expect(m.toBlob.mock.calls[0]?.[2]).toBe(0.84);
  });

  it('truncates very long sessions', async () => {
    const m = mockCanvas();
    await renderShareImage(model(10, 30), 'image/png');
    expect(m.calls.some((c) => c.t === '… contenu tronqué (séance très longue)')).toBe(true);
  });

  it('throws exact French errors', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(renderShareImage(model(1, 1), 'image/png')).rejects.toThrow(
      "Impossible de générer l'image de partage.",
    );
    vi.restoreAllMocks();
    mockCanvas(null);
    await expect(renderShareImage(model(1, 1), 'image/png')).rejects.toThrow(
      "Impossible de finaliser l'image de partage.",
    );
  });
});
