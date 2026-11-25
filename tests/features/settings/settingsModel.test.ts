import { describe, expect, it } from 'vitest';
import { syncMessage } from '@/features/settings/settingsModel';

const r = (sent: number, remaining: number, failed = 0, corrupt = false) => ({ sent, remaining, failed, corrupt });

describe('syncMessage', () => {
  it('succès uniquement quand tout est parti', () => {
    expect(syncMessage(r(2, 0))).toEqual({ text: '2 lots envoyés.', kind: 'success' });
  });

  it('jamais « success » tant qu’il reste des lots', () => {
    expect(syncMessage(r(1, 2))).toEqual({ text: '1 lot envoyé. 2 lots encore en attente.', kind: 'info' });
    expect(syncMessage(r(0, 1)).kind).toBe('error');
  });

  it('refus, file illisible, rien à envoyer', () => {
    expect(syncMessage(r(1, 0, 1))).toEqual({ text: '1 lot envoyé. 1 lot refusé : archivé sur l’appareil.', kind: 'error' });
    expect(syncMessage(r(0, 1, 0, true)).kind).toBe('error');
    expect(syncMessage(r(0, 0))).toEqual({ text: 'Rien à envoyer.', kind: 'info' });
  });
});
