import { useCallback } from 'react';
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router';
import { useOfflineQueueSync } from '../data/queries';
import { useReminderSync } from '../features/settings';
import { useAndroidBackButton } from '../platform/backButton';
import { useReminderTap } from '../platform/notifications';
import { BottomNav, type NavItem, useSwipe } from '../ui';
import { closeTopSheet } from '../ui/Sheet';

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/program', label: 'Programme', icon: 'dumbbell' },
  { to: '/records', label: 'Records', icon: 'trend' },
  { to: '/exercises', label: 'Exercices', icon: 'search' },
];

/** Écrans plein écran (séance, compte rendu) : pas de navigation. */
const NAV_HIDDEN = ['/workout', '/report'];

/** Réserve sous le contenu pour la pilule flottante (hauteur + marge + safe-area). */
const NAV_CLEARANCE =
  'calc(var(--bottom-nav-height) + var(--bottom-nav-gap) * 2 + var(--safe-bottom))';

export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const goBack = useCallback((delta: number) => {
    void navigate(delta);
  }, [navigate]);
  // Rappels locaux : reprogrammés quand les données ou les préférences changent ; un tap ouvre l'accueil.
  useReminderSync();
  const openHome = useCallback(() => {
    void navigate('/');
  }, [navigate]);
  useReminderTap(openHome);
  // Rejoue la file hors-ligne au montage et à chaque retour en ligne.
  useOfflineQueueSync();
  // Bouton retour Android (sans effet hors application native).
  // Une modale ouverte se ferme d'abord ; sinon retour. Sur /workout, revenir est sans perte
  // (séance persistée, l'accueil propose « Reprendre »).
  useAndroidBackButton(goBack, closeTopSheet);
  const showNav = !NAV_HIDDEN.includes(pathname);
  // Glisser entre les 4 onglets (gauche → suivant, droite → précédent) ; ailleurs, sans effet.
  const tab = NAV_ITEMS.findIndex((item) =>
    item.to === '/records'
      ? pathname !== '/records/add' && (matchPath('/records', pathname) !== null || matchPath('/records/:exerciseId', pathname) !== null)
      : matchPath({ path: item.to, end: true }, pathname) !== null,
  );
  const goTab = (delta: number) => {
    const target = NAV_ITEMS[tab + delta];
    if (target) void navigate(target.to);
  };
  useSwipe({
    enabled: tab >= 0,
    onSwipeLeft: () => { goTab(1); },
    onSwipeRight: () => { goTab(-1); },
  });
  return (
    <>
      <main style={showNav ? { paddingBottom: NAV_CLEARANCE } : undefined}>
        <Outlet />
      </main>
      {showNav && <BottomNav items={NAV_ITEMS} />}
    </>
  );
}
