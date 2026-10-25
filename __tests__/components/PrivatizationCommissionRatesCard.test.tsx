import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrivatizationCommissionRatesCard } from '@/components/config/PrivatizationCommissionRatesCard';

const mutateAsync = jest.fn();
const loaded = {
  data: {
    settings: { tableFeeHt: 1, guestFeeHt: 0.25, minInvoiceHt: 5, maxCarryMonths: 3, updatedAt: '2026-10-16T10:00:00Z' },
    onlineRates: { croissance: 5, liberte: 4.5, updatedAt: '2026-10-18T10:00:00Z' },
    privatizationRates: { croissance: 3, liberte: 2.5, updatedAt: '2026-10-25T10:00:00Z' },
    totals: [],
  },
  isPending: false,
  error: null as Error | null,
};
let mockQuery = loaded;

jest.mock('@/lib/hooks/useCommissionSettings', () => ({
  useCommissionSettings: () => mockQuery,
  useUpdateGlobalPrivatizationRates: () => ({ mutateAsync }),
}));

describe('PrivatizationCommissionRatesCard', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mockQuery = loaded;
  });

  it('affiche les taux de privatisation des deux plans', () => {
    render(<PrivatizationCommissionRatesCard />);
    expect(screen.getByText('Commission privatisations')).toBeInTheDocument();
    expect(screen.getByText(/^3\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^2,5\s%$/)).toBeInTheDocument();
    expect(screen.queryByText(/^5\s%$/)).not.toBeInTheDocument();
  });

  it('envoie les nouveaux taux avec le code 2FA', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: 'x', auditLogged: true });
    render(<PrivatizationCommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    expect(screen.getByText('Taux des privatisations')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Plan Liberté'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Confirmer les nouveaux taux'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        croissanceRate: 3,
        liberteRate: 2,
        expectedUpdatedAt: '2026-10-25T10:00:00Z',
        totpCode: '123456',
      }),
    );
  });

  it('avertit pour 0 % avec un texte propre aux privatisations', () => {
    render(<PrivatizationCommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText('Plan Croissance'), { target: { value: '0' } });
    expect(screen.getByText('Un taux de 0 % supprime toute commission sur les privatisations.')).toBeInTheDocument();
  });

  it("affiche l'erreur de chargement", () => {
    mockQuery = { data: undefined as never, isPending: false, error: new Error('Impossible de charger les commissions.') };
    render(<PrivatizationCommissionRatesCard />);
    expect(screen.getByText('Impossible de charger les commissions.')).toBeInTheDocument();
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
  });
});
