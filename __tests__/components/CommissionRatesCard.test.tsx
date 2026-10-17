import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommissionRatesCard } from '@/components/config/CommissionRatesCard';
import { COMMISSION_CONFLICT_MESSAGE, CommissionMutationError } from '@/lib/utils/commissionRates';

const mutateAsync = jest.fn();

const loadedQuery = {
  data: {
    settings: { tableFeeHt: 1, guestFeeHt: 0.25, minInvoiceHt: 5, maxCarryMonths: 3, updatedAt: '2026-10-16T10:00:00Z' },
    totals: [{ period: '2026-09-01', invoicedHt: 120.5, paidHt: 100, invoiceCount: 4 }],
  },
  isPending: false,
  error: null as Error | null,
};
let mockQuery = loadedQuery;

function submitGuestFee(value: string) {
  fireEvent.change(screen.getByLabelText('Par couvert'), { target: { value } });
  fireEvent.click(screen.getByText('Continuer'));
  fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Confirmer le nouveau tarif'));
}

jest.mock('@/lib/hooks/useCommissionSettings', () => ({
  useCommissionSettings: () => mockQuery,
  useUpdateGlobalCommissionRates: () => ({ mutateAsync }),
}));

describe('CommissionRatesCard', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mockQuery = loadedQuery;
  });

  it('affiche le tarif global et les totaux', () => {
    render(<CommissionRatesCard />);
    expect(screen.getByText('Commissions plan Essentiel')).toBeInTheDocument();
    expect(screen.getByText(/^1,00\s€ HT$/)).toBeInTheDocument();
    expect(screen.getByText(/^0,25\s€ HT$/)).toBeInTheDocument();
    expect(screen.getByText('3 mois')).toBeInTheDocument();
    expect(screen.getByText('septembre 2026')).toBeInTheDocument();
  });

  it("affiche l'erreur de chargement en français", () => {
    mockQuery = { data: undefined as never, isPending: false, error: new Error('Impossible de charger les commissions.') };
    render(<CommissionRatesCard />);
    expect(screen.getByText('Impossible de charger les commissions.')).toBeInTheDocument();
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
  });

  it('refuse un montant invalide puis demande le code 2FA', () => {
    render(<CommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));

    fireEvent.change(screen.getByLabelText('Par table réservée'), { target: { value: '1,234' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByText(/montant invalide/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Par table réservée'), { target: { value: '1,20' } });
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByLabelText(/Code de votre application/)).toBeInTheDocument();
  });

  it('refuse une saisie identique au tarif actuel', () => {
    render(<CommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.click(screen.getByText('Continuer'));
    expect(screen.getByText('Aucune valeur modifiée')).toBeInTheDocument();
  });

  it('envoie le nouveau tarif avec le code', async () => {
    mutateAsync.mockResolvedValue({ updatedAt: '2026-10-16T11:00:00Z', auditLogged: true });
    render(<CommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText('Par couvert'), { target: { value: '0,30' } });
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Confirmer le nouveau tarif'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mutateAsync).toHaveBeenCalledWith({
      tableFeeHt: 1,
      guestFeeHt: 0.3,
      minInvoiceHt: 5,
      maxCarryMonths: 3,
      expectedUpdatedAt: '2026-10-16T10:00:00Z',
      totpCode: '123456',
    });
  });

  it("garde la modale ouverte et affiche l'erreur si la modification échoue", async () => {
    mutateAsync.mockRejectedValue(new Error('Code de vérification invalide'));
    render(<CommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByLabelText('Par couvert'), { target: { value: '0,30' } });
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Confirmer le nouveau tarif'));

    expect(await screen.findByText('Code de vérification invalide')).toBeInTheDocument();
    expect(screen.getByLabelText(/Code de votre application/)).toHaveValue('');
    expect(screen.getByLabelText(/Code de votre application/)).toHaveFocus();
  });

  it('après un conflit, revient au formulaire avec les valeurs à jour', async () => {
    mutateAsync.mockRejectedValueOnce(new CommissionMutationError(COMMISSION_CONFLICT_MESSAGE, 'failed-precondition'));
    const { rerender } = render(<CommissionRatesCard />);
    fireEvent.click(screen.getByText('Modifier'));
    submitGuestFee('0,30');

    expect(await screen.findByRole('alert')).toHaveTextContent(COMMISSION_CONFLICT_MESSAGE);
    expect(screen.getByLabelText('Par couvert')).toHaveValue('0,25');

    // Le rechargement apporte le tarif modifié par un autre admin.
    mockQuery = {
      ...loadedQuery,
      data: {
        ...loadedQuery.data,
        settings: { ...loadedQuery.data.settings, tableFeeHt: 1.5, updatedAt: '2026-10-16T10:30:00Z' },
      },
    };
    rerender(<CommissionRatesCard />);
    expect(screen.getByLabelText('Par table réservée')).toHaveValue('1,5');

    mutateAsync.mockResolvedValueOnce({ updatedAt: '2026-10-16T11:00:00Z', auditLogged: true });
    submitGuestFee('0,30');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mutateAsync).toHaveBeenLastCalledWith({
      tableFeeHt: 1.5,
      guestFeeHt: 0.3,
      minInvoiceHt: 5,
      maxCarryMonths: 3,
      expectedUpdatedAt: '2026-10-16T10:30:00Z',
      totpCode: '123456',
    });
  });
});
