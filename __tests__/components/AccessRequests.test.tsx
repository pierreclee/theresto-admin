// Page « Demandes d'espace restaurant » : filtre par statut (en attente par défaut), colonnes,
// « Inviter » (invitation classique ou parcours accompagné, adresse préremplie) et « Refuser »
// (confirmation, refus de la base affiché).
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AccessRequestsPage from '@/app/access-requests/page';
import { AccessRequestsTable, truncateMessage } from '@/components/accessRequests/AccessRequestsTable';
import { ActionError } from '@/lib/api/actionResult';
import type { AccessRequest } from '@/lib/types/accessRequests';

const useRestaurantAccessRequests = jest.fn();
const mutateAsync = jest.fn();
const refresh = jest.fn();
jest.mock('@/lib/hooks/useAccessRequests', () => ({
  useRestaurantAccessRequests: (filter: string) => useRestaurantAccessRequests(filter),
  useDeclineRestaurantAccessRequest: () => ({ mutateAsync, isPending: false }),
  useRefreshAccessRequests: () => refresh,
}));
const toast = jest.fn();
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => toast }));
jest.mock('@/components/restaurants/InviteRestaurantModal', () => ({
  InviteRestaurantModal: (p: { initialEmail?: string; onInvited?: () => void }) => (
    <div data-testid="invite-email" data-email={p.initialEmail}>
      <button onClick={p.onInvited}>simuler invitation</button>
    </div>
  ),
}));
jest.mock('@/components/restaurants/AccompaniedOnboardingModal', () => ({
  AccompaniedOnboardingModal: (p: { initialEmail?: string; onInvited?: () => void }) => (
    <div data-testid="invite-accompanied" data-email={p.initialEmail}>
      <button onClick={p.onInvited}>simuler invitation</button>
    </div>
  ),
}));

const pending: AccessRequest = {
  id: 'req-1', userId: 'u1', restaurantName: 'Chez Paul', city: 'Lyon', phone: '+33612345678',
  message: 'x'.repeat(200), status: 'pending', createdAt: '2026-12-06T10:00:00Z', handledAt: null,
  email: 'paul@exemple.fr',
};
const invited: AccessRequest = {
  ...pending, id: 'req-2', restaurantName: 'Le Zinc', status: 'invited', handledAt: '2026-12-07T10:00:00Z', message: null,
};

beforeEach(() => jest.clearAllMocks());

describe('page', () => {
  it('en attente par défaut, puis les autres filtres', () => {
    useRestaurantAccessRequests.mockReturnValue({ data: { requests: [pending], truncated: false }, isPending: false, error: null });
    render(<AccessRequestsPage />);
    expect(useRestaurantAccessRequests).toHaveBeenLastCalledWith('pending');
    expect(screen.getByRole('tab', { name: 'En attente' }).getAttribute('aria-selected')).toBe('true');
    for (const [label, value] of [['Invitées', 'invited'], ['Refusées', 'declined'], ['Toutes', 'all']]) {
      fireEvent.click(screen.getByRole('tab', { name: label }));
      expect(useRestaurantAccessRequests).toHaveBeenLastCalledWith(value);
    }
  });

  it('refus de lecture (journal) : message affiché', () => {
    useRestaurantAccessRequests.mockReturnValue({
      data: undefined, isPending: false, error: new ActionError('Consultation impossible : journal.', 'audit-log-failed'),
    });
    render(<AccessRequestsPage />);
    expect(screen.getByRole('alert').textContent).toContain('Consultation impossible : journal.');
  });
});

describe('table', () => {
  it('colonnes : date, restaurant, ville, téléphone, e-mail, message tronqué, statut', () => {
    render(<AccessRequestsTable requests={[pending, invited]} />);
    const row = screen.getByText('Chez Paul').closest('tr')!;
    expect(within(row).getByText('Lyon')).toBeTruthy();
    expect(within(row).getByText('+33612345678').getAttribute('href')).toBe('tel:+33612345678');
    expect(within(row).getByText('paul@exemple.fr')).toBeTruthy();
    expect(within(row).getByText(truncateMessage(pending.message))).toBeTruthy();
    expect(within(row).getByText('En attente')).toBeTruthy();
    const other = screen.getByText('Le Zinc').closest('tr')!;
    expect(within(other).getByText('Invitée')).toBeTruthy();
    // Actions seulement pour une demande en attente.
    expect(within(other).queryByRole('button')).toBeNull();
  });

  it('message tronqué à 80 caractères', () => {
    expect(truncateMessage('a'.repeat(200))).toHaveLength(80);
    expect(truncateMessage('a'.repeat(200)).endsWith('…')).toBe(true);
    expect(truncateMessage('court')).toBe('court');
    expect(truncateMessage(null)).toBe('—');
  });

  it.each([
    ['Invitation par e-mail (7 jours)', 'invite-email'],
    ['Parcours accompagné (2 heures, lien et QR code)', 'invite-accompanied'],
  ])('Inviter → %s : adresse préremplie, liste rechargée après l invitation', (choice, testId) => {
    render(<AccessRequestsTable requests={[pending]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Inviter Chez Paul' }));
    fireEvent.click(screen.getByRole('button', { name: choice }));
    const modal = screen.getByTestId(testId);
    expect(modal.getAttribute('data-email')).toBe('paul@exemple.fr');
    fireEvent.click(within(modal).getByRole('button', { name: 'simuler invitation' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('compte supprimé (adresse NULL) : « Inviter » désactivé', () => {
    render(<AccessRequestsTable requests={[{ ...pending, email: null }]} />);
    expect((screen.getByRole('button', { name: 'Inviter Chez Paul' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Refuser : confirmation, puis action et toast', async () => {
    mutateAsync.mockResolvedValue({ id: 'req-1', status: 'declined', handledAt: null, auditLogged: true });
    render(<AccessRequestsTable requests={[pending]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refuser Chez Paul' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Refuser la demande' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('req-1'));
    expect(toast).toHaveBeenCalledWith('Demande refusée');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Refuser : journal en échec signalé par un toast d erreur', async () => {
    mutateAsync.mockResolvedValue({ id: 'req-1', status: 'declined', handledAt: null, auditLogged: false });
    render(<AccessRequestsTable requests={[pending]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refuser Chez Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refuser la demande' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/n'a pas pu être journalisée/), 'error'));
  });

  it('Refuser : demande déjà traitée (P0A06), message affiché dans la confirmation', async () => {
    mutateAsync.mockRejectedValue(new ActionError('Cette demande a déjà été traitée (invitée ou refusée). La liste est rechargée.', 'conflict'));
    render(<AccessRequestsTable requests={[pending]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refuser Chez Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refuser la demande' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/déjà été traitée/));
    expect(toast).not.toHaveBeenCalled();
  });
});
