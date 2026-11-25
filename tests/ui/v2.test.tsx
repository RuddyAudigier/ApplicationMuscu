import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { BottomNav, Button, Pill, StatTile, type NavItem } from '../../src/ui';

describe('Pill', () => {
  it('exposes role="radio" with aria-checked and calls onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <div role="radiogroup" aria-label="Variante">
        <Pill selected onSelect={onSelect}>
          Classique
        </Pill>
        <Pill onSelect={onSelect}>Pausé 2 ct</Pill>
      </div>,
    );
    const classique = screen.getByRole('radio', { name: 'Classique' });
    const pause = screen.getByRole('radio', { name: 'Pausé 2 ct' });
    expect(classique).toHaveAttribute('aria-checked', 'true');
    expect(pause).toHaveAttribute('aria-checked', 'false');
    expect(pause).toHaveAttribute('type', 'button');
    await userEvent.click(pause);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('applies the accent tone only when selected and respects disabled', async () => {
    const onSelect = vi.fn();
    render(
      <>
        <Pill selected tone="accent" onSelect={onSelect}>
          A
        </Pill>
        <Pill tone="accent" disabled onSelect={onSelect}>
          B
        </Pill>
      </>,
    );
    const a = screen.getByRole('radio', { name: 'A' });
    const b = screen.getByRole('radio', { name: 'B' });
    expect(a.className).toMatch(/accent/);
    expect(b.className).not.toMatch(/accent/);
    expect(b).toBeDisabled();
    await userEvent.click(b);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('StatTile', () => {
  it('renders value, unit and label', () => {
    render(<StatTile label="PR" value={3} unit="kg" tone="accent" />);
    const tile = screen.getByText('PR').parentElement;
    expect(tile).toHaveTextContent('3kgPR');
    expect(tile?.className).toMatch(/accent/);
  });

  it('renders without unit (default tone)', () => {
    render(<StatTile label="Séries" value="12" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Séries').parentElement?.className).not.toMatch(/accent/);
  });
});

describe('Button accent', () => {
  it('renders the accent variant', () => {
    render(<Button variant="accent">Valider la série</Button>);
    expect(screen.getByRole('button', { name: 'Valider la série' }).className).toMatch(/accent/);
  });
});

describe('BottomNav v2', () => {
  const items: NavItem[] = [
    { to: '/', label: 'Accueil', icon: 'home' },
    { to: '/program', label: 'Programme', icon: 'dumbbell' },
    { to: '/records', label: 'Records', icon: 'trend' },
    { to: '/exercises', label: 'Exercices', icon: 'search' },
  ];

  const renderAt = (path: string) => {
    const router = createMemoryRouter([{ path: '*', element: <BottomNav items={items} /> }], {
      initialEntries: [path],
    });
    render(<RouterProvider router={router} />);
  };

  it('is icon-only with aria-labels', () => {
    renderAt('/');
    // Marqueur utilisé par Toast.module.css pour placer les toasts au-dessus de la pilule.
    expect(screen.getByRole('navigation')).toHaveAttribute('data-bottom-nav');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link).toHaveAttribute('aria-label');
      expect(link.textContent).toBe('');
    }
  });

  it('marks nested routes active (records/:id) and not home', () => {
    renderAt('/records/abc');
    expect(screen.getByRole('link', { name: 'Records' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute('aria-current');
  });
});
