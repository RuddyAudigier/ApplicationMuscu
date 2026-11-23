import { NavLink } from 'react-router';
import styles from './BottomNav.module.css';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface NavItem {
  to: string;
  /** Nom accessible (la navigation n'affiche que l'icône). */
  label: string;
  icon: IconName;
}

export interface BottomNavProps {
  items: NavItem[];
}

/** Navigation flottante en pilule : icônes seules, item actif clair (aria-current="page"). */
export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav aria-label="Navigation principale" className={styles.nav}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.to} className={styles.item}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) => cx(styles.link, isActive && styles.active)}
            >
              <Icon name={item.icon} size={22} />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
