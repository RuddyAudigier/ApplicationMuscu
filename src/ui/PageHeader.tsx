import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';
import { IconButton } from './IconButton';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  /** Affiche un bouton « Retour » à gauche. */
  onBack?: () => void;
  /** Actions à droite (IconButton, Button…). */
  actions?: ReactNode;
  /** Le titre n'est qu'une marque : pas de <h1> (l'écran fournit le sien). */
  decorative?: boolean;
}

/**
 * En-tête commun de tous les écrans : même marge haute, même hauteur de ligne et même taille de titre,
 * pour que les titres tombent à la même hauteur d'un onglet à l'autre.
 * La zone sûre du haut est déjà réservée par le body.
 */
export function PageHeader({ title, subtitle, onBack, actions, decorative }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {onBack && (
        <IconButton icon="back" label="Retour" onClick={onBack} className={styles.back} />
      )}
      <div className={styles.text}>
        {decorative ? (
          <span className={styles.title}>{title}</span>
        ) : (
          <h1 className={styles.title}>{title}</h1>
        )}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
