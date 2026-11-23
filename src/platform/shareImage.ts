import type { ImprovementStatus, SharePayload } from '@/domain/model';

export interface ShareImageModel {
  title: string;
  subtitle: string;
  summary: SharePayload['summary'];
  blocks: { name: string; lines: { main: string; bench: string; status: ImprovementStatus }[] }[];
  footer: string;
}

const STATUS_COLOR: Record<ImprovementStatus, string> = {
  improved: '#166534',
  equaled: '#64748b',
  below: '#b91c1c',
  'data-capture': '#1e40af',
  none: '#1e40af',
};

export async function renderShareImage(
  model: ShareImageModel,
  mime: 'image/jpeg' | 'image/png',
): Promise<Blob> {
  const seriesCount = model.blocks.reduce((sum, b) => sum + b.lines.length, 0);
  const height = Math.min(3600, Math.max(1400, 280 + 56 * model.blocks.length + 72 * seriesCount + 120));

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossible de générer l'image de partage.");

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 1200, height);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 48px Arial';
  ctx.fillText(model.title, 64, 90);

  ctx.fillStyle = '#334155';
  ctx.font = '600 28px Arial';
  ctx.fillText(model.subtitle, 64, 136);

  const { summary } = model;
  ctx.font = '600 22px Arial';
  ctx.fillStyle = '#166534';
  ctx.fillText(`▲ ${String(summary.improved)} améliorées`, 64, 176);
  ctx.fillStyle = '#64748b';
  ctx.fillText(`= ${String(summary.equaled)} égalées`, 280, 176);
  ctx.fillStyle = '#b91c1c';
  ctx.fillText(`↘ ${String(summary.below)} en-dessous`, 468, 176);
  ctx.fillStyle = '#1e40af';
  ctx.fillText(`● ${String(summary.dataCapture)} prises de données`, 698, 176);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 198);
  ctx.lineTo(1136, 198);
  ctx.stroke();

  let y = 246;
  const maxY = height - 80;
  let truncated = false;

  for (const block of model.blocks) {
    if (block.lines.length === 0) continue;
    if (y > maxY - 100) {
      truncated = true;
      break;
    }
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 30px Arial';
    ctx.fillText(block.name, 64, y);
    y += 38;

    for (const line of block.lines) {
      if (y > maxY) {
        truncated = true;
        break;
      }
      ctx.fillStyle = '#334155';
      ctx.font = '500 25px Arial';
      ctx.fillText(`• ${line.main}`, 84, y);
      y += 34;

      ctx.font = '600 22px Arial';
      ctx.fillStyle = STATUS_COLOR[line.status];
      ctx.fillText(`  ${line.bench}`, 104, y);
      y += 30;
    }
    if (truncated) break;
    y += 22;
  }

  if (truncated) {
    ctx.fillStyle = '#b91c1c';
    ctx.font = '700 24px Arial';
    ctx.fillText('… contenu tronqué (séance très longue)', 64, maxY + 24);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '500 20px Arial';
  ctx.fillText(model.footer, 64, height - 26);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Impossible de finaliser l'image de partage."));
      },
      mime,
      0.84,
    );
  });
}
