import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('CommissionRatesModal (avertissement 0 %)', () => {
  const warning = 'Un taux de 0 % supprime toute commission sur les paiements en ligne.';

  function renderModal(onConfirm = jest.fn().mockResolvedValue(undefined)) {
    render(
      <CommissionRatesModal
        title="Taux"
        fields={[{ key: 'croissance', label: 'Croissance', initial: 5, kind: 'percent' }]}
        warning="Attention"
        confirmLabel="Valider"
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    return onConfirm;
  }

  it('affiche l avertissement pour 0', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Croissance'), { target: { value: '0' } });
    expect(screen.getByText(warning)).toBeInTheDocument();
  });

  it('n affiche pas l avertissement pour 5', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Croissance'), { target: { value: '5' } });
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it('autorise la soumission avec 0 et garde l avertissement à l étape du code', async () => {
    const onConfirm = renderModal();
    fireEvent.change(screen.getByLabelText('Croissance'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(warning)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Valider'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ croissance: 0 }, '123456'));
  });
});
