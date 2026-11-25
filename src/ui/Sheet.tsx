import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Sheet.module.css';
import { IconButton } from './IconButton';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Zone d'actions collée en bas du panneau. */
  footer?: ReactNode;
  /** Masque le bouton « Fermer » de l'en-tête. */
  hideClose?: boolean;
  /** « alertdialog » pour une confirmation. */
  role?: 'dialog' | 'alertdialog';
  'aria-describedby'?: string;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Pile des modales ouvertes : seule la plus haute réagit au clavier. */
const openStack: { close: () => void }[] = [];

/** Ferme la modale la plus haute (bouton retour Android) ; `false` si aucune n'est ouverte. */
export function closeTopSheet(): boolean {
  const top = openStack[openStack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}
/** Vrai si au moins une modale est ouverte. */
export function hasOpenSheet(): boolean {
  return openStack.length > 0;
}
/** overflow du body avant l'ouverture de la première modale de la pile. */
let savedOverflow = '';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/** Modale bas d'écran : portail, piège de focus, Échap, overlay, verrou du défilement. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  hideClose = false,
  role = 'dialog',
  'aria-describedby': describedBy,
}: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const token = {
      close: () => {
        onCloseRef.current();
      },
    };
    if (openStack.length === 0) savedOverflow = document.body.style.overflow;
    openStack.push(token);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    (focusables(panel)[0] ?? panel).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(panel);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (event.shiftKey && (active === first || active === panel || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(token), 1);
      // Le verrou ne tombe qu'à la fermeture de la dernière modale, quel que soit l'ordre.
      if (openStack.length === 0) document.body.style.overflow = savedOverflow;
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.root}>
      {/* Le clic sur le fond est un raccourci souris ; Échap et « Fermer » couvrent le clavier. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles.overlay} data-testid="sheet-overlay" onClick={onClose} />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={styles.panel}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {!hideClose && <IconButton icon="x" label="Fermer" variant="surface" onClick={onClose} />}
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
