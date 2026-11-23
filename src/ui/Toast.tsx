import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import styles from './Toast.module.css';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastProps {
  message: string;
  kind?: ToastKind;
  onDismiss: () => void;
}

const icons: Record<ToastKind, IconName> = { info: 'chevron', success: 'check', error: 'x' };

export function Toast({ message, kind = 'info', onDismiss }: ToastProps) {
  return (
    <div className={cx(styles.toast, styles[kind])}>
      <span className={styles.icon}>
        <Icon name={icons[kind]} size={18} />
      </span>
      <p className={styles.message}>{message}</p>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Masquer la notification"
        onClick={onDismiss}
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

interface ToastApi {
  show: (msg: string, kind?: ToastKind) => void;
}

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const DURATION_MS: Record<ToastKind, number> = { info: 4000, success: 4000, error: 6000 };

const ToastContext = createContext<ToastApi | null>(null);

/** Hôte des notifications : erreurs en role="alert", le reste en role="status". */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list, { id, message, kind }]);
      timers.current.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, DURATION_MS[kind]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => {
        clearTimeout(timer);
      });
      pending.clear();
    };
  }, []);

  const api = useMemo(() => ({ show }), [show]);
  const render = (list: ToastItem[]) =>
    list.map((t) => (
      <Toast
        key={t.id}
        message={t.message}
        kind={t.kind}
        onDismiss={() => {
          dismiss(t.id);
        }}
      />
    ));

  return (
    <ToastContext value={api}>
      {children}
      <div className={styles.viewport}>
        <div role="status" aria-live="polite" className={styles.stack}>
          {render(toasts.filter((t) => t.kind !== 'error'))}
        </div>
        <div role="alert" aria-live="assertive" className={styles.stack}>
          {render(toasts.filter((t) => t.kind === 'error'))}
        </div>
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast doit être utilisé dans un UiProvider');
  return api;
}
