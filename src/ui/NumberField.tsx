import styles from './Field.module.css';
import { FieldShell } from './Field';
import { cx } from './cx';

export interface NumberFieldProps {
  label: string;
  /** Valeur brute saisie (la virgule est conservée ; le parsing revient aux features). */
  value: string;
  onChange: (value: string) => void;
  /** Unité affichée dans le champ (kg, reps…). */
  unit?: string;
  hint?: string;
  error?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Chiffres avec séparateur décimal point ou virgule. */
const DECIMAL_PATTERN = '[0-9]*[.,]?[0-9]*';

export function NumberField({
  label,
  value,
  onChange,
  unit,
  hint,
  error,
  id,
  name,
  placeholder,
  disabled,
  className,
}: NumberFieldProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      className={cx(styles.number, className)}
      id={id}
    >
      {(a11y) => (
        <div className={cx(styles.affix, unit && styles.withUnit)}>
          <input
            {...a11y}
            type="text"
            inputMode="decimal"
            pattern={DECIMAL_PATTERN}
            autoComplete="off"
            name={name}
            placeholder={placeholder}
            disabled={disabled}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            className={styles.control}
          />
          {unit && (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  );
}
