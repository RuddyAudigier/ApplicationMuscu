import type { ButtonHTMLAttributes } from 'react';
import styles from './IconButton.module.css';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  icon: IconName;
  /** Nom accessible (obligatoire : le bouton n'a pas de texte visible). */
  label: string;
  /** `surface` : rond plein (#161615 ; #262624 dans un panneau), comme « Retour » / « Fermer ». */
  variant?: 'ghost' | 'surface' | 'primary' | 'danger';
}

/** Classes d'un IconButton, pour un <Link> qui doit en avoir l'allure. */
export function iconButtonClasses(variant: NonNullable<IconButtonProps['variant']> = 'ghost'): string {
  return cx(styles.button, styles[variant]);
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={cx(iconButtonClasses(variant), className)}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}
