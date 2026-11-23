import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';
import { IconButton } from './IconButton';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Affiche un bouton « Retour » à gauche. */
  onBack?: () => void;
  /** Actions à droite (IconButton, Button…). */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, onBack, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {onBack && (
        <IconButton icon="chevron" label="Retour" onClick={onBack} className={styles.back} />
      )}
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
