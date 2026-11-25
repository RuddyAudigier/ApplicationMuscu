import type { ElementType, ReactNode } from 'react';
import styles from './SectionTitle.module.css';
import { cx } from './cx';

export interface SectionTitleProps {
  /** `section` : titre de bloc (display) ; `eyebrow` : petite étiquette en capitales. */
  level?: 'section' | 'eyebrow';
  /** Balise rendue (h2 par défaut). */
  as?: ElementType;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Titre de section : deux niveaux seulement, pour une hiérarchie identique sur tous les écrans. */
export function SectionTitle({ level = 'section', as: Tag = 'h2', id, className, children }: SectionTitleProps) {
  return (
    <Tag id={id} className={cx(styles.title, styles[level], className)}>
      {children}
    </Tag>
  );
}
