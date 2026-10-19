import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SubscriptionModal } from '@/components/restaurants/SubscriptionModal';

const mutateAsync = jest.fn();
jest.mock('@/lib/hooks/useRestaurants', () => ({
  useUpdateSubscription: () => ({ mutateAsync, isPending: false }),
}));
jest.mock('@/lib/hooks/useSubscriptionPrices', () => ({
  useSubscriptionPrices: () => ({ data: undefined }),
  formatPlanPrice: () => '',
}));

function renderModal(onClose = jest.fn()) {
  render(<SubscriptionModal restaurantId="r1" restaurantName="Le Bistro" currentPlan="croissance" onClose={onClose} />);
  return onClose;
}

function chooseLiberteAndContinue() {
  fireEvent.click(screen.getByText('Liberté'));
  fireEvent.click(screen.getByText('Passer en Liberté'));
}

describe('SubscriptionModal (étape TOTP)', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('demande le code 2FA avant de changer de plan, sans appeler le serveur à l étape 1', () => {
    renderModal();
    chooseLiberteAndContinue();
    expect(screen.getByLabelText(/Code de votre application/)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Confirmer le passage en Liberté')).toBeDisabled();
  });

  it('envoie le plan et le code puis ferme', async () => {
    mutateAsync.mockResolvedValue({ success: true, auditLogged: true });
    const onClose = renderModal();
    chooseLiberteAndContinue();
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Confirmer le passage en Liberté'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ restaurantId: 'r1', plan: 'liberte', totpCode: '123456' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('affiche l erreur française et vide le code quand il est invalide', async () => {
    mutateAsync.mockRejectedValue(new Error('Code de vérification invalide'));
    const onClose = renderModal();
    chooseLiberteAndContinue();
    const input = screen.getByLabelText(/Code de votre application/);
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.click(screen.getByText('Confirmer le passage en Liberté'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code de vérification invalide');
    expect(input).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
  });
});
