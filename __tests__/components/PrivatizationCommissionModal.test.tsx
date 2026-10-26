import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrivatizationCommissionModal } from '@/components/restaurants/PrivatizationCommissionModal';

const mutateAsync = jest.fn();
jest.mock('@/lib/hooks/useCommissionSettings', () => ({
  useSetRestaurantPrivatizationRate: () => ({ mutateAsync }),
}));

const followsPlan = { effective: 3, custom: null, planRate: 3, updatedAt: null };
const custom = { effective: 1.5, custom: 1.5, planRate: 3, updatedAt: '2026-10-25T10:00:00Z' };

function confirmWithCode(label: string) {
  fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
  fireEvent.click(screen.getByText(label));
}

describe('PrivatizationCommissionModal', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('enregistre un taux particulier avec le code 2FA', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: 'x', auditLogged: true });
    render(
      <PrivatizationCommissionModal restaurantId="r1" mode="edit" privatizationRate={followsPlan} onClose={() => {}} />,
    );
    expect(screen.getByText(/premier paiement est encaissé à partir de maintenant/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Taux particulier'), { target: { value: '1,5' } });
    fireEvent.click(screen.getByText('Continuer'));
    confirmWithCode('Enregistrer le taux particulier');
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ rate: 1.5, expectedUpdatedAt: null, totpCode: '123456' }),
    );
  });

  it('revient au taux du plan avec le code 2FA', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: 'x', auditLogged: true });
    render(<PrivatizationCommissionModal restaurantId="r1" mode="reset" privatizationRate={custom} onClose={() => {}} />);
    expect(screen.getByText(/pour ses prochaines privatisations/)).toBeInTheDocument();
    confirmWithCode('Revenir au taux du plan');
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        rate: null,
        expectedUpdatedAt: '2026-10-25T10:00:00Z',
        totpCode: '123456',
      }),
    );
  });
});
