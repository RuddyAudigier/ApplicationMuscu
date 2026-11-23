import { Outlet, useLocation } from 'react-router';
import { BottomNav, type NavItem } from '../ui';

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
  const showNav = !NAV_HIDDEN.includes(pathname);
  return (
    <>
      <main style={showNav ? { paddingBottom: NAV_CLEARANCE } : undefined}>
        <Outlet />
      </main>
      {showNav && <BottomNav items={NAV_ITEMS} />}
    </>
  );
}
