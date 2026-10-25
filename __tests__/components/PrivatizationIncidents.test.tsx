import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IncidentMoneyModal } from '@/components/incidents/IncidentMoneyModal';
import { IncidentResolveModal } from '@/components/incidents/IncidentResolveModal';
import { PrivatizationIncidentsTable } from '@/components/incidents/PrivatizationIncidentsTable';
import type { PrivatizationIncident } from '@/lib/types/privatizationIncidents';

const moneyMutate = jest.fn();
const resolveMutate = jest.fn();
jest.mock('@/lib/hooks/usePrivatizationIncidents', () => ({
  useIncidentMoneyAction: () => ({ mutateAsync: moneyMutate }),
  useResolveIncident: () => ({ mutateAsync: resolveMutate }),
}));

function incident(overrides: Partial<PrivatizationIncident> = {}): PrivatizationIncident {
  return {
    id: 'inc-1',
    kind: 'refund_failed',
    status: 'open',
    amount: 120,
    restaurantId: 'r1',
    restaurantName: 'Chez Paul',
    privatizationId: 'p1',
    privatization: {
      date: '2026-11-20',
      organizerName: 'Alice Martin',
      organizerEmail: 'alice@test.com',
      status: 'cancelled',
      occasionType: 'Anniversaire',
      totalPrice: 1200,
      paymentStatus: 'paid',
    },
    paymentId: 'pay-1',
    stripeAccountId: 'acct_1',
    stripeObjectId: 'pi_1',
    details: { error: 'Insufficient funds (balance_insufficient)', attempts: 2 },
    resolution: null,
    resolvedAt: null,
    createdAt: '2026-10-25T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
    actions: ['retryRefund', 'resolve'],
    ...overrides,
  };
}

describe('PrivatizationIncidentsTable', () => {
  it('affiche les libellés français, le lien restaurant et les détails Stripe', () => {
    render(
      <PrivatizationIncidentsTable
        incidents={[
          incident(),
          incident({ id: 'inc-2', kind: 'customer_balance_funds', actions: ['returnCustomerBalance', 'resolve'], details: {} }),
          incident({ id: 'inc-3', kind: 'paid_after_cancellation', details: {} }),
          incident({ id: 'inc-4', kind: 'refund_awaiting_iban', actions: ['resolve'], details: {} }),
        ]}
      />,
    );
    expect(screen.getByText('Remboursement en échec')).toBeInTheDocument();
    expect(screen.getByText('Virement non rattaché')).toBeInTheDocument();
    expect(screen.getByText('Payé après annulation')).toBeInTheDocument();
    expect(screen.getByText('IBAN du client attendu')).toBeInTheDocument();
    expect(screen.getByText(/il y a plus de 7 jours/)).toBeInTheDocument();
    expect(screen.getByText('Relancer le remboursement')).toBeInTheDocument();
    expect(screen.getByText('Restituer au client')).toBeInTheDocument();
    expect(screen.getByText('Rembourser le client')).toBeInTheDocument();
    expect(screen.getByText(/Erreur Stripe : Insufficient funds/)).toBeInTheDocument();
    expect(screen.getByText('Tentatives : 2')).toBeInTheDocument();
    expect(screen.getAllByText('Chez Paul')[0].closest('a')).toHaveAttribute('href', '/restaurants/r1');
  });

  it("n'affiche aucune action pour un incident traité", () => {
    render(
      <PrivatizationIncidentsTable
        incidents={[incident({ status: 'resolved', actions: [], resolution: 'Remboursé dans Stripe' })]}
      />,
    );
    expect(screen.queryByText('Relancer le remboursement')).not.toBeInTheDocument();
    expect(screen.queryByText('Marquer traité')).not.toBeInTheDocument();
    expect(screen.getByText(/Note : Remboursé dans Stripe/)).toBeInTheDocument();
  });

  it('affiche un message quand il n’y a aucun incident', () => {
    render(<PrivatizationIncidentsTable incidents={[]} />);
    expect(screen.getByText('Aucun incident.')).toBeInTheDocument();
  });
});

describe('IncidentMoneyModal', () => {
  beforeEach(() => moneyMutate.mockReset());

  it('relance le remboursement avec le code 2FA', async () => {
    moneyMutate.mockResolvedValue({ status: 'resolved', refundedAmount: 120, auditLogged: true });
    const onClose = jest.fn();
    render(<IncidentMoneyModal incident={incident()} action="retryRefund" onClose={onClose} />);
    const confirm = screen.getAllByText('Relancer le remboursement').find((el) => el.tagName === 'BUTTON')!;
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '123456' } });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(moneyMutate).toHaveBeenCalledWith({ incidentId: 'inc-1', action: 'retryRefund', totpCode: '123456' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('restitue le solde client et affiche l’erreur du serveur telle quelle', async () => {
    moneyMutate.mockRejectedValue(new Error('Stripe a refusé la restitution : No cash balance'));
    const onClose = jest.fn();
    render(
      <IncidentMoneyModal
        incident={incident({ kind: 'customer_balance_funds', actions: ['returnCustomerBalance', 'resolve'] })}
        action="returnCustomerBalance"
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Code de votre application/), { target: { value: '654321' } });
    fireEvent.click(screen.getAllByText('Restituer au client').find((el) => el.tagName === 'BUTTON')!);
    await waitFor(() =>
      expect(moneyMutate).toHaveBeenCalledWith({ incidentId: 'inc-1', action: 'returnCustomerBalance', totpCode: '654321' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Stripe a refusé la restitution : No cash balance');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('IncidentResolveModal', () => {
  beforeEach(() => resolveMutate.mockReset());

  it('refuse une note vide', async () => {
    render(<IncidentResolveModal incident={incident()} status="resolved" onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Marquer traité' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Décrivez en quelques mots/);
    expect(resolveMutate).not.toHaveBeenCalled();
  });

  it('ignore l’incident avec la note, sans code 2FA', async () => {
    resolveMutate.mockResolvedValue({ status: 'ignored', auditLogged: true });
    const onClose = jest.fn();
    render(<IncidentResolveModal incident={incident()} status="ignored" onClose={onClose} />);
    expect(screen.queryByLabelText(/Code de votre application/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Doublon de test  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ignorer' }));
    await waitFor(() =>
      expect(resolveMutate).toHaveBeenCalledWith({ incidentId: 'inc-1', resolution: 'Doublon de test', status: 'ignored' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
