import { NetworkError } from '../ports';

export const OFFLINE_SAVE_MESSAGE = 'Hors ligne : enregistrement impossible, réessaie avec du réseau.';

/**
 * Mutation sans file locale (tout sauf les performances) : hors ligne, elle échoue tout de suite
 * en `NetworkError` au lieu d'être mise en pause en silence par TanStack (`networkMode: 'always'`).
 */
export const onlineOnly = {
  networkMode: 'always',
} as const;

export function requireOnline<A, R>(run: (vars: A) => Promise<R>): (vars: A) => Promise<R> {
  return (vars) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.reject(new NetworkError(OFFLINE_SAVE_MESSAGE));
    return run(vars);
  };
}
