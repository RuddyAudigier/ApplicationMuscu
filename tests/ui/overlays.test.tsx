import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button, Sheet, UiProvider, useConfirm, useToast } from '../../src/ui';
import { closeTopSheet } from '../../src/ui/Sheet';

function SheetHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Ouvrir
      </Button>
      <Sheet
        open={open}
        title="Détails"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <button type="button">Premier</button>
        <button type="button">Dernier</button>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('closeTopSheet ferme la modale ouverte (bouton retour Android) et renvoie false sinon', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    expect(closeTopSheet()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    let handled = false;
    act(() => { handled = closeTopSheet(); });
    expect(handled).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(closeTopSheet()).toBe(false);
  });

  it('Sheet traps focus and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    const opener = screen.getByRole('button', { name: 'Ouvrir' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Détails' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');

    const close = screen.getByRole('button', { name: 'Fermer' });
    const first = screen.getByRole('button', { name: 'Premier' });
    const last = screen.getByRole('button', { name: 'Dernier' });
    expect(close).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(last).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on overlay click and close button, not on panel click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('sheet-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps body scroll locked until the last stacked sheet closes, in any order', () => {
    const noop = () => undefined;
    const tree = (a: boolean, b: boolean) => (
      <>
        <Sheet open={a} title="A" onClose={noop}>
          a
        </Sheet>
        <Sheet open={b} title="B" onClose={noop}>
          b
        </Sheet>
      </>
    );
    const { rerender } = render(tree(true, true));
    expect(document.body.style.overflow).toBe('hidden');
    rerender(tree(false, true));
    expect(document.body.style.overflow).toBe('hidden');
    rerender(tree(false, false));
    expect(document.body.style.overflow).toBe('');
  });

  it('renders footer into document.body and refocuses panel when nothing is focusable', () => {
    render(
      <Sheet open title="T" onClose={() => undefined} footer={<span>pied</span>} hideClose>
        corps
      </Sheet>,
    );
    expect(screen.getByText('pied')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('body')).toBe(document.body);
    expect(dialog).toHaveFocus();
  });
});

function ConfirmHarness({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <Button
      onClick={() => {
        void confirm({
          title: 'Supprimer ?',
          message: 'Action définitive.',
          confirmLabel: 'Supprimer',
          danger: true,
        }).then(onResult);
      }}
    >
      Lancer
    </Button>
  );
}

describe('ConfirmDialog', () => {
  it('ConfirmDialog resolves true on confirm and false on cancel', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <UiProvider>
        <ConfirmHarness onResult={onResult} />
      </UiProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Lancer' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer ?' });
    expect(dialog).toHaveAccessibleDescription('Action définitive.');
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onResult).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lancer' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onResult).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole('button', { name: 'Lancer' }));
    await user.keyboard('{Escape}');
    expect(onResult).toHaveBeenLastCalledWith(false);
    expect(onResult).toHaveBeenCalledTimes(3);
  });

  it('uses a default confirm label and cancels a pending request when a new one arrives', async () => {
    const user = userEvent.setup();
    const results: boolean[] = [];
    function H() {
      const confirm = useConfirm();
      return (
        <Button
          onClick={() => {
            void confirm({ title: 'Sûr ?', message: 'm' }).then((r) => results.push(r));
            void confirm({ title: 'Vraiment ?', message: 'm2' }).then((r) => results.push(r));
          }}
        >
          Go
        </Button>
      );
    }
    render(
      <UiProvider>
        <H />
      </UiProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('alertdialog', { name: 'Vraiment ?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(results).toEqual([false, true]);
  });

  it('resolves a pending request with false on unmount', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const { unmount } = render(
      <UiProvider>
        <ConfirmHarness onResult={onResult} />
      </UiProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Lancer' }));
    unmount();
    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(false);
    });
  });

  it('hooks throw outside UiProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function C() {
      useConfirm();
      return null;
    }
    function T() {
      useToast();
      return null;
    }
    expect(() => render(<C />)).toThrow(/UiProvider/);
    expect(() => render(<T />)).toThrow(/UiProvider/);
  });
});

function ToastHarness() {
  const toast = useToast();
  return (
    <>
      <Button
        onClick={() => {
          toast.show('Séance enregistrée', 'success');
        }}
      >
        Ok
      </Button>
      <Button
        onClick={() => {
          toast.show('Info simple');
        }}
      >
        Info
      </Button>
      <Button
        onClick={() => {
          toast.show('Échec réseau', 'error');
        }}
      >
        Ko
      </Button>
    </>
  );
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Toast is announced via role=status', async () => {
    const user = userEvent.setup();
    render(
      <UiProvider>
        <ToastHarness />
      </UiProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Ok' }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Séance enregistrée');
    await user.click(screen.getByRole('button', { name: 'Info' }));
    expect(status).toHaveTextContent('Info simple');
  });

  it('success toasts auto-dismiss', () => {
    vi.useFakeTimers();
    render(
      <UiProvider>
        <ToastHarness />
      </UiProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: 'Ok' }).click();
    });
    expect(screen.getByText('Séance enregistrée')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText('Séance enregistrée')).not.toBeInTheDocument();
  });

  it('error toasts use role=alert and stay until dismissed', () => {
    vi.useFakeTimers();
    render(
      <UiProvider>
        <ToastHarness />
      </UiProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: 'Ko' }).click();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Échec réseau');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Échec réseau');
    act(() => {
      screen.getByRole('button', { name: 'Masquer la notification' }).click();
    });
    expect(screen.queryByText('Échec réseau')).not.toBeInTheDocument();
  });

  it('toast can be dismissed manually', async () => {
    const user = userEvent.setup();
    render(
      <UiProvider>
        <ToastHarness />
      </UiProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Ok' }));
    await user.click(screen.getByRole('button', { name: 'Masquer la notification' }));
    expect(screen.queryByText('Séance enregistrée')).not.toBeInTheDocument();
  });
});
