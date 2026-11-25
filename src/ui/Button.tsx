import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

/** `accent` = citron (action principale) ; `primary` = pilule claire. */
export type ButtonVariant = 'accent' | 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  /** Occupe toute la largeur disponible. */
  fullWidth?: boolean;
  /** Icône placée avant le libellé. */
  icon?: IconName;
  /** Désactive le bouton et affiche un indicateur de chargement. */
  loading?: boolean;
}

/** Classes d'un bouton, pour un <Link> qui doit en avoir l'allure. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: 'md' | 'lg' = 'md', fullWidth = false): string {
  return cx(styles.button, styles[variant], styles[size], fullWidth && styles.full);
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses(variant, size, fullWidth), className)}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={size === 'lg' ? 22 : 20} />
      )}
      <span className={styles.label}>{children}</span>
    </button>
  );
}
