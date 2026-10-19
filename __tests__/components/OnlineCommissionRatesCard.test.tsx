import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnlineCommissionRatesCard } from '@/components/config/OnlineCommissionRatesCard';

const mutateAsync = jest.fn();
const loaded = {
  data: {
    settings: { tableFeeHt: 1, guestFeeHt: 0.25, minInvoiceHt: 5, maxCarryMonths: 3, updatedAt: '2026-10-16T10:00:00Z' },
    onlineRates: { croissance: 5, liberte: 4.5, updatedAt: '2026-10-18T10:00:00Z' },
    totals: [],
  },
  isPending: false,
  error: null as Error | null,
};
let mockQuery = loaded;

jest.mock('@/lib/hooks/useCommissionSettings', () => ({
  useCommissionSettings: () => mockQuery,
  useUpdateGlobalOnlineRates: () => ({ mutateAsync }),
}));

describe('OnlineCommissionRatesCard', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mockQuery = loaded;
  });

  it('affiche les taux des deux plans', () => {
    render(<OnlineCommissionRatesCard />);
    expect(screen.getByText('Commission paiements en ligne')).toBeInTheDocument();
    expect(screen.getByText(/^5\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^4,5\s%$/)).toBeInTheDocument();
  });

  it('envoie les nouveaux taux avec le code 2FA', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: 'x', auditLogged: true });
    render(<OnlineCommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText('Plan Croissance'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Confirmer les nouveaux taux'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        croissanceRate: 4,
        liberteRate: 4.5,
        expectedUpdatedAt: '2026-10-18T10:00:00Z',
        totpCode: '123456',
      }),
    );
  });

  it('refuse un taux invalide', () => {
    render(<OnlineCommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText('Plan Liberté'), { target: { value: '120' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByText(/taux invalide/)).toBeInTheDocument();
  });

  it("affiche l'erreur de chargement", () => {
    mockQuery = { data: undefined as never, isPending: false, error: new Error('Impossible de charger les commissions.') };
    render(<OnlineCommissionRatesCard />);
    expect(screen.getByText('Impossible de charger les commissions.')).toBeInTheDocument();
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
  });
});
