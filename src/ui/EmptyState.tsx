import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  /** Appel à l'action (souvent un Button). */
  action?: ReactNode;
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon && (
        <span className={styles.icon}>
          <Icon name={icon} size={32} />
        </span>
      )}
      <h2 className={styles.title}>{title}</h2>
      {message && <p className={styles.message}>{message}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
