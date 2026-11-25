import styles from './ErrorNotice.module.css';
import { Button } from './Button';
import { cx } from './cx';

export interface ErrorNoticeProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

/** Erreur de chargement honnête : carte rouge discrète + « Réessayer ». */
export function ErrorNotice({ message, onRetry, className }: ErrorNoticeProps) {
  return (
    <div className={cx(styles.notice, className)} role="alert">
      <p className={styles.text}>{message}</p>
      <Button variant="secondary" onClick={onRetry}>Réessayer</Button>
    </div>
  );
}
