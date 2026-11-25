import { describe, expect, it } from 'vitest';
import {
  applyPreferences,
  applyStoredPreferences,
  DISPLAY_PREFS_KEY,
  loadPreferences,
  savePreferences,
} from '@/features/settings';

const root = () => document.documentElement;

describe('préférences d’affichage', () => {
  it('valeurs par défaut quand rien n’est stocké ou contenu illisible', () => {
    expect(loadPreferences()).toEqual({ reduceMotion: false, fontScale: '100' });
    localStorage.setItem(DISPLAY_PREFS_KEY, '{oops');
    expect(loadPreferences()).toEqual({ reduceMotion: false, fontScale: '100' });
    localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify({ reduceMotion: 'oui', fontScale: '999' }));
    expect(loadPreferences()).toEqual({ reduceMotion: false, fontScale: '100' });
  });

  it('enregistre puis relit', () => {
    savePreferences({ reduceMotion: true, fontScale: '120' });
    expect(loadPreferences()).toEqual({ reduceMotion: true, fontScale: '120' });
  });

  it('stockage indisponible : lecture par défaut, écriture sans planter', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    } as unknown as Storage;
    expect(loadPreferences(broken)).toEqual({ reduceMotion: false, fontScale: '100' });
    expect(savePreferences({ reduceMotion: true, fontScale: '110' }, broken)).toBe(false);
  });

  it('localStorage bloqué (SecurityError à l’accès) : défauts, aucune exception', () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('blocked', 'SecurityError'); },
    });
    try {
      expect(loadPreferences()).toEqual({ reduceMotion: false, fontScale: '100' });
      expect(savePreferences({ reduceMotion: true, fontScale: '110' })).toBe(false);
      expect(() => { applyStoredPreferences(); }).not.toThrow();
    } finally {
      if (desc) Object.defineProperty(window, 'localStorage', desc);
      else Reflect.deleteProperty(window, 'localStorage');
    }
  });

  it('applique les attributs sur la racine (et les retire)', () => {
    applyPreferences({ reduceMotion: true, fontScale: '110' });
    expect(root()).toHaveAttribute('data-reduce-motion');
    expect(root()).toHaveAttribute('data-font-scale', '110');
    applyPreferences({ reduceMotion: false, fontScale: '100' });
    expect(root()).not.toHaveAttribute('data-reduce-motion');
    expect(root()).not.toHaveAttribute('data-font-scale');
  });

  it('applyStoredPreferences applique ce qui est stocké (démarrage)', () => {
    savePreferences({ reduceMotion: true, fontScale: '120' });
    applyStoredPreferences();
    expect(root()).toHaveAttribute('data-font-scale', '120');
    expect(root()).toHaveAttribute('data-reduce-motion');
    applyPreferences({ reduceMotion: false, fontScale: '100' });
  });
});
