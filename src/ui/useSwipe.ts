import { useEffect, useRef } from 'react';
import { hasOpenSheet } from './Sheet';

export interface SwipeHandlers {
  /** Glisser vers la gauche (doigt de droite à gauche). */
  onSwipeLeft?: () => void;
  /** Glisser vers la droite. */
  onSwipeRight?: () => void;
  /** Désactive la détection (ex. écran sans onglets). */
  enabled?: boolean;
}

const MIN_DX = 60;
const RATIO = 1.5;
/** Bande de chaque bord réservée au geste retour du système. */
const EDGE = 24;
const IGNORED = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-no-swipe]';

/** Vrai si un ancêtre peut défiler horizontalement (carrousel, tableau…). */
function inHorizontalScroller(start: Element): boolean {
  for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue;
    const overflowX = getComputedStyle(el).overflowX;
    if (overflowX === 'auto' || overflowX === 'scroll') return true;
  }
  return false;
}

/**
 * Détecte un glissement horizontal net sur le document : |dx| > 60 px et |dx| > 1,5 · |dy|.
 * Ignore les gestes démarrés dans un champ, une zone défilant à l'horizontale, un élément
 * `[data-no-swipe]` ou pendant qu'une modale est ouverte.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, enabled = true }: SwipeHandlers): void {
  const handlers = useRef({ onSwipeLeft, onSwipeRight });

  useEffect(() => {
    handlers.current = { onSwipeLeft, onSwipeRight };
  });

  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1 || hasOpenSheet()) return;
      const target = e.target;
      if (target instanceof Element && (target.closest(IGNORED) || inHorizontalScroller(target))) return;
      const t = e.touches[0];
      if (!t || t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      start = { x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent) => {
      const from = start;
      start = null;
      const t = e.changedTouches[0];
      if (!from || !t || hasOpenSheet()) return;
      const dx = t.clientX - from.x;
      const dy = t.clientY - from.y;
      if (Math.abs(dx) <= MIN_DX || Math.abs(dx) <= RATIO * Math.abs(dy)) return;
      if (dx < 0) handlers.current.onSwipeLeft?.();
      else handlers.current.onSwipeRight?.();
    };
    const cancel = () => {
      start = null;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', cancel);
    };
  }, [enabled]);
}
