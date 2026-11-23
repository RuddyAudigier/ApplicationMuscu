import { App } from '@capacitor/app';
import { useEffect } from 'react';
import { isNative } from './native';

export function useAndroidBackButton(navigate: (delta: number) => void): void {
  useEffect(() => {
    if (!isNative()) return;
    const handle = App.addListener('backButton', () => {
      if (window.history.length > 1 && window.location.pathname !== '/') {
        navigate(-1);
      } else {
        void App.exitApp();
      }
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [navigate]);
}
