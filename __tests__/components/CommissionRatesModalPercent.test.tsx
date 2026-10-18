import { fireEvent, render, screen } from '@testing-library/react';
import { CommissionRatesModal } from '@/components/config/CommissionRatesModal';

describe('CommissionRatesModal (kind percent)', () => {
  it('refuse un taux invalide', () => {
    render(
      <CommissionRatesModal
        title="Taux"
        fields={[{ key: 'croissance', label: 'Croissance', initial: 5, kind: 'percent' }]}
        warning="Attention"
        confirmLabel="Valider"
        onConfirm={async () => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText('Croissance'), { target: { value: '101' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByRole('alert')).toHaveTextContent(/taux invalide/);
  });
});
