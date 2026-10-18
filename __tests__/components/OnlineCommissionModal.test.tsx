import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnlineCommissionModal, onlineRateLabel } from '@/components/restaurants/OnlineCommissionModal';

const mutateAsync = jest.fn();
jest.mock('@/lib/hooks/useCommissionSettings', () => ({
  useSetRestaurantOnlineRate: () => ({ mutateAsync }),
}));

const followsPlan = { effective: 5, custom: null, planRate: 5, updatedAt: null };
const custom = { effective: 7.25, custom: 7.25, planRate: 5, updatedAt: '2026-10-18T10:00:00Z' };

function confirmWithCode(label: string) {
  fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
  fireEvent.click(screen.getByText(label));
}

describe('onlineRateLabel', () => {
  it('indique la provenance du taux', () => {
    expect(onlineRateLabel(followsPlan, 'croissance')).toMatch(/^5\s% \(taux du plan Croissance\)$/);
    expect(onlineRateLabel(custom, 'liberte')).toMatch(/^7,25\s% \(taux particulier\)$/);
    expect(onlineRateLabel(followsPlan, 'essentiel')).toMatch(/^5\s% \(taux du plan Croissance\)$/);
  });
});

describe('OnlineCommissionModal', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('enregistre un taux particulier avec le code 2FA', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: 'x', auditLogged: true });
    render(<OnlineCommissionModal restaurantId="r1" mode="edit" onlineRate={followsPlan} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Taux particulier'), { target: { value: '7,25' } });
    fireEvent.click(screen.getByText('Continuer'));
    confirmWithCode('Enregistrer le taux particulier');
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ rate: 7.25, expectedUpdatedAt: null, totpCode: '123456' }),
    );
  });

  it('revient au taux du plan avec le code 2FA', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: 'x', auditLogged: true });
    render(<OnlineCommissionModal restaurantId="r1" mode="reset" onlineRate={custom} onClose={() => {}} />);
    confirmWithCode('Revenir au taux du plan');
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        rate: null,
        expectedUpdatedAt: '2026-10-18T10:00:00Z',
        totpCode: '123456',
      }),
    );
  });
});

describe('OnlineCommissionModal (0 %)', () => {
  beforeEach(() => mutateAsync.mockReset());

  it('avertit pour 0 % sans bloquer l enregistrement', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: 'x', auditLogged: true });
    render(<OnlineCommissionModal restaurantId="r1" mode="edit" onlineRate={followsPlan} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Taux particulier'), { target: { value: '0' } });
    expect(screen.getByText('Un taux de 0 % supprime toute commission sur les paiements en ligne.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continuer'));
    confirmWithCode('Enregistrer le taux particulier');
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ rate: 0, expectedUpdatedAt: null, totpCode: '123456' }),
    );
  });
});
