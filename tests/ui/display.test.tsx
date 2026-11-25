import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import {
  Badge,
  BottomNav,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  ProgressBar,
  Skeleton,
  iconNames,
  type NavItem,
} from '../../src/ui';

describe('Button', () => {
  it('renders variants and defaults to type=button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Primaire</Button>
        <Button variant="danger" size="lg" fullWidth icon="trash">
          Supprimer
        </Button>
        <Button type="submit" variant="ghost">
          Envoyer
        </Button>
      </>,
    );
    const primary = screen.getByRole('button', { name: 'Primaire' });
    expect(primary).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Envoyer' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
    await user.click(primary);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is busy and disabled while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Enregistrer
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Enregistrer' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('uses its label as accessible name', () => {
    render(<IconButton icon="edit" label="Modifier" variant="primary" />);
    expect(screen.getByRole('button', { name: 'Modifier' })).toHaveAttribute('type', 'button');
  });
});

describe('Icon', () => {
  it('is aria-hidden by default', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is labelled when a label is given', () => {
    render(<Icon name="check" label="Validé" size={16} />);
    expect(screen.getByRole('img', { name: 'Validé' })).toHaveAttribute('width', '16');
  });

  it.each(iconNames)('renders %s', (name) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector('svg')?.childElementCount).toBeGreaterThan(0);
  });
});

describe('Card, Badge, EmptyState, Skeleton', () => {
  it('Card renders a labelled section when titled', () => {
    render(
      <Card title="Résumé" className="x">
        contenu
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Résumé' })).toHaveTextContent('contenu');
  });

  it('Card without title is a plain container', () => {
    render(<Card>brut</Card>);
    expect(screen.getByText('brut')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('Badge renders with tone', () => {
    render(
      <>
        <Badge tone="pr">PR</Badge>
        <Badge>neutre</Badge>
      </>,
    );
    expect(screen.getByText('PR')).toBeInTheDocument();
    expect(screen.getByText('neutre')).toBeInTheDocument();
  });

  it('EmptyState shows title, message and action', () => {
    render(
      <EmptyState
        icon="dumbbell"
        title="Aucun exercice"
        message="Ajoutez-en un."
        action={<button type="button">Ajouter</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Aucun exercice' })).toBeInTheDocument();
    expect(screen.getByText('Ajoutez-en un.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('EmptyState minimal', () => {
    render(<EmptyState title="Vide" />);
    expect(screen.getByRole('heading', { name: 'Vide' })).toBeInTheDocument();
  });

  it('Skeleton is hidden from assistive tech', () => {
    const { container } = render(<Skeleton width="50%" height={20} />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveStyle({ width: '50%', height: '20px' });
  });
});

describe('ProgressBar', () => {
  it('exposes progressbar semantics and clamps', () => {
    render(
      <>
        <ProgressBar label="Objectif" value={150} max={100} />
        <ProgressBar label="Séance" value={-3} />
      </>,
    );
    const p = screen.getByRole('progressbar', { name: 'Objectif' });
    expect(p).toHaveAttribute('aria-valuenow', '100');
    expect(p).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByRole('progressbar', { name: 'Séance' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });
});

describe('PageHeader', () => {
  it('renders title, back button and actions', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <PageHeader
        title="Exercices"
        onBack={onBack}
        actions={<button type="button">Plus</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Exercices' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Plus' })).toBeInTheDocument();
  });

  it('omits back button without onBack', () => {
    render(<PageHeader title="Accueil" />);
    expect(screen.queryByRole('button', { name: 'Retour' })).not.toBeInTheDocument();
  });
});

describe('BottomNav', () => {
  it('renders NavLinks and marks the active one', () => {
    const items: NavItem[] = [
      { to: '/', label: 'Accueil', icon: 'home' },
      { to: '/exercises', label: 'Exercices', icon: 'dumbbell' },
    ];
    const router = createMemoryRouter([{ path: '*', element: <BottomNav items={items} /> }], {
      initialEntries: ['/exercises'],
    });
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exercices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute('aria-current');
  });
});
