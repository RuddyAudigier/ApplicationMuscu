import { NavLink } from 'react-router';
import styles from './BottomNav.module.css';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

export interface BottomNavProps {
  items: NavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav aria-label="Navigation principale" className={styles.nav}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.to} className={styles.item}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cx(styles.link, isActive && styles.active)}
            >
              <span className={styles.icon}>
                <Icon name={item.icon} size={22} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
