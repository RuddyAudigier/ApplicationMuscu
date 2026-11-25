import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import styles from './ConfirmDialog.module.css';
import { Button } from './Button';
import { Sheet } from './Sheet';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Libellé du bouton de confirmation (défaut « Confirmer »). */
  confirmLabel?: string;
  /** Action destructrice : bouton rouge. */
  danger?: boolean;
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const messageId = useId();
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      role="alertdialog"
      aria-describedby={messageId}
      hideClose
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant={danger ? 'danger' : 'accent'} size="lg" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p id={messageId} className={styles.message}>
        {message}
      </p>
    </Sheet>
  );
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Hôte unique du dialogue de confirmation (monté par UiProvider). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false);
        pending.current = resolve;
        setRequest(opts);
      }),
    [],
  );

  // Démontage avec une demande en attente : la promesse se résout à false.
  useEffect(() => {
    const ref = pending;
    return () => {
      ref.current?.(false);
      ref.current = null;
    };
  }, []);

  const settle = (value: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(value);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {request && (
        <ConfirmDialog
          {...request}
          open
          onConfirm={() => {
            settle(true);
          }}
          onCancel={() => {
            settle(false);
          }}
        />
      )}
    </ConfirmContext>
  );
}

/** Ouvre une confirmation et résout `true` (confirmé) ou `false` (annulé). */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm doit être utilisé dans un UiProvider');
  return confirm;
}
