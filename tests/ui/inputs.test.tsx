import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Chip, Field, NumberField, Segmented } from '../../src/ui';

function NumberHarness({ onValue }: { onValue: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <NumberField
      label="Poids"
      unit="kg"
      value={v}
      onChange={(next) => {
        setV(next);
        onValue(next);
      }}
    />
  );
}

describe('NumberField', () => {
  it('NumberField accepts comma input', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<NumberHarness onValue={onValue} />);
    const input = screen.getByRole('textbox', { name: /Poids/ });
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input.getAttribute('pattern')).toMatch(/,/);
    await user.type(input, '72,5');
    expect(input).toHaveValue('72,5');
    expect(onValue).toHaveBeenLastCalledWith('72,5');
    expect(screen.getByText('kg')).toBeInTheDocument();
  });

  it('shows an error linked to the input', () => {
    render(
      <NumberField label="Reps" value="x" onChange={() => undefined} error="Nombre invalide" />,
    );
    const input = screen.getByRole('textbox', { name: 'Reps' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Nombre invalide');
  });
});

describe('Field', () => {
  it('renders an input with label, hint and error', () => {
    render(<Field label="Nom" hint="Obligatoire" error="Champ requis" defaultValue="" />);
    const input = screen.getByRole('textbox', { name: 'Nom' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Obligatoire Champ requis');
    expect(screen.getByText('Champ requis')).toBeInTheDocument();
  });

  it('renders a textarea', async () => {
    const user = userEvent.setup();
    render(<Field as="textarea" label="Notes" defaultValue="" />);
    const area = screen.getByRole('textbox', { name: 'Notes' });
    expect(area.tagName).toBe('TEXTAREA');
    expect(area).not.toHaveAttribute('aria-invalid');
    await user.type(area, 'ok');
    expect(area).toHaveValue('ok');
  });

  it('renders a select', async () => {
    const user = userEvent.setup();
    render(
      <Field as="select" label="Muscle" defaultValue="a">
        <option value="a">Pectoraux</option>
        <option value="b">Dos</option>
      </Field>,
    );
    const select = screen.getByRole('combobox', { name: 'Muscle' });
    await user.selectOptions(select, 'b');
    expect(select).toHaveValue('b');
  });
});

describe('Segmented', () => {
  it('Segmented exposes radiogroup semantics', async () => {
    const user = userEvent.setup();
    function H() {
      const [v, setV] = useState('8');
      return (
        <Segmented
          label="RPE"
          value={v}
          onChange={setV}
          options={['6', '7', '8', '9', '10'].map((x) => ({ value: x, label: x }))}
        />
      );
    }
    render(<H />);
    expect(screen.getByRole('radiogroup', { name: 'RPE' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    const radio = (name: string) => screen.getByRole('radio', { name });
    expect(radio('8')).toHaveAttribute('aria-checked', 'true');
    expect(radio('8')).toHaveAttribute('tabindex', '0');
    expect(radio('6')).toHaveAttribute('tabindex', '-1');

    await user.click(radio('6'));
    expect(radio('6')).toHaveAttribute('aria-checked', 'true');
    expect(radio('6')).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(radio('7')).toHaveAttribute('aria-checked', 'true');
    expect(radio('7')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(radio('10')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Home}');
    expect(radio('6')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(radio('10')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown}');
    expect(radio('6')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowUp}a');
    expect(radio('10')).toHaveAttribute('aria-checked', 'true');
  });

  it('makes the first option tabbable when value matches none', () => {
    render(
      <Segmented
        label="X"
        value="z"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('Chip', () => {
  it('is a toggle button with aria-pressed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Chip selected onClick={onClick}>
        Pectoraux
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Pectoraux' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip);
    expect(onClick).toHaveBeenCalled();
  });

  it('defaults to unselected', () => {
    render(<Chip onClick={() => undefined}>Dos</Chip>);
    expect(screen.getByRole('button', { name: 'Dos' })).toHaveAttribute('aria-pressed', 'false');
  });
});
