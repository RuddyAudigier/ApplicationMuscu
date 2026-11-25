import type { ReactNode } from 'react';
import { ConfirmProvider } from './ConfirmDialog';
import { ToastProvider } from './Toast';

/** Monte les hôtes globaux de l'UI : notifications et dialogue de confirmation. */
export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
