import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Field.module.css';
import { cx } from './cx';

interface FieldBase {
  label: string;
  /** Aide affichée sous le champ. */
  hint?: string;
  /** Message d'erreur : marque le champ aria-invalid. */
  error?: string;
  /** Classe du conteneur. */
  className?: string;
}

type InputFieldProps = FieldBase & { as?: 'input' } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className'
  >;
type TextareaFieldProps = FieldBase & { as: 'textarea' } & Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'className'
  >;
type SelectFieldProps = FieldBase & { as: 'select' } & Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    'className'
  >;

export type FieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

interface ControlA11y {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

interface FieldShellProps extends FieldBase {
  id: string | undefined;
  /** Rend le contrôle avec les attributs d'accessibilité calculés. */
  children: (a11y: ControlA11y) => ReactNode;
}

/** Libellé + contrôle + aide + erreur, reliés par id / aria-describedby. */
export function FieldShell({ label, hint, error, className, id, children }: FieldShellProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
      </label>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Retire le discriminant `as` avant de transmettre les props au contrôle natif. */
function omitAs<T extends { as?: string }>(control: T): Omit<T, 'as'> {
  const rest: Omit<T, 'as'> & { as?: string } = { ...control };
  delete rest.as;
  return rest;
}

export function Field({ label, hint, error, className, id, ...control }: FieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className} id={id}>
      {(a11y) => {
        if (control.as === 'textarea') {
          const rest = omitAs(control);
          return <textarea {...rest} {...a11y} className={cx(styles.control, styles.textarea)} />;
        }
        if (control.as === 'select') {
          const rest = omitAs(control);
          return <select {...rest} {...a11y} className={cx(styles.control, styles.select)} />;
        }
        const rest = omitAs(control);
        return <input {...rest} {...a11y} className={styles.control} />;
      }}
    </FieldShell>
  );
}
