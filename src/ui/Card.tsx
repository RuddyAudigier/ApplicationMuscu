import { useId, type ReactNode } from 'react';
import styles from './Card.module.css';
import { cx } from './cx';

export interface CardProps {
  /** Titre optionnel : la carte devient une région nommée. */
  title?: string;
  /** Élément placé à droite du titre (bouton, badge…). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, aside, className, children }: CardProps) {
  const titleId = useId();
  if (title === undefined) {
    return <div className={cx(styles.card, className)}>{children}</div>;
  }
  return (
    <section className={cx(styles.card, className)} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
