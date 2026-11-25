import { App } from '@capacitor/app';
import { useEffect } from 'react';
import { isNative } from './native';

const NO_INTERCEPT = (): boolean => false;

/**
 * Bouton retour Android. `intercept` est consulté d'abord (ex. fermer la modale ouverte) :
 * s'il renvoie `true`, ni navigation ni sortie de l'appli. Passer une fonction stable.
 */
export function useAndroidBackButton(navigate: (delta: number) => void, intercept: () => boolean = NO_INTERCEPT): void {
  useEffect(() => {
    if (!isNative()) return;
    const handle = App.addListener('backButton', () => {
      if (intercept()) return;
      if (window.history.length > 1 && window.location.pathname !== '/') {
        navigate(-1);
      } else {
        void App.exitApp();
      }
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [navigate, intercept]);
}
