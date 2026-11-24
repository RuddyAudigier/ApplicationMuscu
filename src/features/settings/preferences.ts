/** Préférences d'affichage locales à l'appareil (appliquées avant le premier rendu). */
export const DISPLAY_PREFS_KEY = 'display_prefs_v1';

/** Paliers de `data-font-scale` définis dans `ui/tokens.css` (100 = défaut, pas d'attribut). */
export type FontScale = '100' | '110' | '120';

export interface DisplayPreferences {
  reduceMotion: boolean;
  fontScale: FontScale;
}

const SCALES: readonly string[] = ['100', '110', '120'];
const DEFAULTS: DisplayPreferences = { reduceMotion: false, fontScale: '100' };

const isScale = (v: unknown): v is FontScale => typeof v === 'string' && SCALES.includes(v);

/** Lecture tolérante : stockage indisponible ou contenu illisible → défauts. */
export function loadPreferences(storage: Storage = localStorage): DisplayPreferences {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DISPLAY_PREFS_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULTS };
    const { reduceMotion, fontScale } = parsed as Record<string, unknown>;
    return {
      reduceMotion: reduceMotion === true,
      fontScale: isScale(fontScale) ? fontScale : DEFAULTS.fontScale,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** `false` si le stockage refuse l'écriture (le réglage reste appliqué pour la session). */
export function savePreferences(prefs: DisplayPreferences, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/** Pose les attributs lus par `ui/global.css` (`data-reduce-motion`) et `ui/tokens.css` (`data-font-scale`). */
export function applyPreferences(prefs: DisplayPreferences, root: HTMLElement = document.documentElement): void {
  if (prefs.reduceMotion) root.setAttribute('data-reduce-motion', '');
  else root.removeAttribute('data-reduce-motion');
  if (prefs.fontScale === '100') root.removeAttribute('data-font-scale');
  else root.setAttribute('data-font-scale', prefs.fontScale);
}

/** Démarrage (`main.tsx`) : applique les préférences enregistrées avant le premier rendu. */
export function applyStoredPreferences(): void {
  applyPreferences(loadPreferences());
}
