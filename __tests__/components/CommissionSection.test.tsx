import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommissionSection } from '@/components/restaurants/CommissionSection';
import type { RestaurantCommission } from '@/lib/types/commissions';

const updateMutateAsync = jest.fn();
const resetMutateAsync = jest.fn();

const baseCommission: RestaurantCommission = {
  tableFeeHt: 1,
  guestFeeHt: 0.25,
  isCustom: false,
  updatedAt: null,
  subscriptionPlan: 'essentiel',
  paymentMethodReady: true,
  suspended: false,
  invoices: [],
  onlineRate: null,
};
let mockCommission: RestaurantCommission = baseCommission;

jest.mock('@/lib/hooks/useCommissionSettings', () => ({
  useRestaurantCommission: () => ({ data: mockCommission, isPending: false, error: null }),
  useUpdateRestaurantCommissionRates: () => ({ mutateAsync: updateMutateAsync }),
  useResetRestaurantCommissionRates: () => ({ mutateAsync: resetMutateAsync }),
}));

function enterCode() {
  fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
}

describe('CommissionSection', () => {
  beforeEach(() => {
    updateMutateAsync.mockReset().mockResolvedValue({ updatedAt: '2026-10-17T10:00:00Z', auditLogged: true });
    resetMutateAsync.mockReset().mockResolvedValue({ updatedAt: '2026-10-17T10:00:00Z', auditLogged: true });
    mockCommission = baseCommission;
  });

  it('tarif global : « Personnaliser », pas de retour au tarif global', () => {
    render(<CommissionSection restaurantId="r1" />);
    expect(screen.getByText('Tarif global')).toBeInTheDocument();
    expect(screen.getByText('Personnaliser')).toBeInTheDocument();
    expect(screen.queryByText('Revenir au tarif global')).not.toBeInTheDocument();
    expect(screen.getByText('Aucune facture de commissions.')).toBeInTheDocument();
  });

  it('tarif personnalisé : « Modifier » et retour au tarif global', () => {
    mockCommission = { ...baseCommission, isCustom: true, updatedAt: '2026-10-16T10:00:00Z' };
    render(<CommissionSection restaurantId="r1" />);
    expect(screen.getByText('Tarif personnalisé')).toBeInTheDocument();
    expect(screen.getByText('Modifier')).toBeInTheDocument();
    expect(screen.getByText('Revenir au tarif global')).toBeInTheDocument();
  });

  it('signale un tarif sans effet sur un plan payant, pas sur Essentiel ni sans plan', () => {
    mockCommission = { ...baseCommission, subscriptionPlan: 'croissance' };
    const { rerender } = render(<CommissionSection restaurantId="r1" />);
    expect(screen.getByText(/sans effet tant que le restaurant a un plan payant/)).toBeInTheDocument();

    mockCommission = { ...baseCommission, subscriptionPlan: null };
    rerender(<CommissionSection restaurantId="r1" />);
    expect(screen.queryByText(/sans effet/)).not.toBeInTheDocument();
  });

  it('lien Stripe uniquement pour une URL https', () => {
    mockCommission = {
      ...baseCommission,
      invoices: [
        { id: 'i1', period: '2026-09-01', bookingCount: 3, guestCount: 8, amountHt: 5, status: 'paid', hostedInvoiceUrl: 'https://invoice.stripe.com/i/1' },
        { id: 'i2', period: '2026-08-01', bookingCount: 2, guestCount: 4, amountHt: 3, status: 'open', hostedInvoiceUrl: 'javascript:alert(1)' },
        { id: 'i3', period: '2026-07-01', bookingCount: 1, guestCount: 2, amountHt: 1.5, status: 'draft', hostedInvoiceUrl: null },
      ],
    };
    render(<CommissionSection restaurantId="r1" />);
    expect(screen.getByRole('link', { name: /Payée/ })).toHaveAttribute('href', 'https://invoice.stripe.com/i/1');
    expect(screen.getByText('En attente de paiement').closest('a')).toBeNull();
    expect(screen.getByText('En préparation').closest('a')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('personnalise un tarif global avec expectedUpdatedAt null', async () => {
    render(<CommissionSection restaurantId="r1" />);
    fireEvent.click(screen.getByText('Personnaliser'));
    fireEvent.change(screen.getByLabelText('Par table réservée'), { target: { value: '0,80' } });
    fireEvent.click(screen.getByText('Continuer'));
    enterCode();
    fireEvent.click(screen.getByText('Enregistrer le tarif'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(updateMutateAsync).toHaveBeenCalledWith({
      tableFeeHt: 0.8,
      guestFeeHt: 0.25,
      expectedUpdatedAt: null,
      totpCode: '123456',
    });
  });

  it('fige le tarif global sans modification', async () => {
    render(<CommissionSection restaurantId="r1" />);
    fireEvent.click(screen.getByText('Personnaliser'));
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByText(/Tarif figé pour ce restaurant/)).toBeInTheDocument();
    enterCode();
    fireEvent.click(screen.getByText('Figer le tarif'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(updateMutateAsync).toHaveBeenCalledWith({
      tableFeeHt: 1,
      guestFeeHt: 0.25,
      expectedUpdatedAt: null,
      totpCode: '123456',
    });
  });

  it('refuse une saisie inchangée pour un tarif déjà personnalisé', () => {
    mockCommission = { ...baseCommission, isCustom: true, updatedAt: '2026-10-16T10:00:00Z' };
    render(<CommissionSection restaurantId="r1" />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByRole('alert')).toHaveTextContent('Aucune valeur modifiée');
  });

  it('revient au tarif global avec le seul code 2FA', async () => {
    mockCommission = { ...baseCommission, isCustom: true, updatedAt: '2026-10-16T10:00:00Z' };
    render(<CommissionSection restaurantId="r1" />);
    fireEvent.click(screen.getByText('Revenir au tarif global'));

    const dialog = screen.getByRole('dialog');
    expect(screen.queryByText('Continuer')).not.toBeInTheDocument();
    expect(dialog.querySelectorAll('input')).toHaveLength(1);
    enterCode();
    fireEvent.click(screen.getAllByText('Revenir au tarif global').find((el) => dialog.contains(el) && el.tagName === 'BUTTON')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(resetMutateAsync).toHaveBeenCalledWith({ expectedUpdatedAt: '2026-10-16T10:00:00Z', totpCode: '123456' });
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });
});
