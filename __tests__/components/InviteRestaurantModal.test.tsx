// RGPD-29 (lot 9, D2) : l'invitation est journalisée par l'Edge Function admin-onboarding ;
// auditLogged=false (invitation faite, journal en échec) est signalé par un toast d'erreur.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InviteRestaurantModal } from '@/components/restaurants/InviteRestaurantModal';
import { inviteRestaurantOwnerAction } from '@/lib/actions/invitations';

jest.mock('@/lib/actions/invitations', () => ({ inviteRestaurantOwnerAction: jest.fn() }));
const toast = jest.fn();
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => toast }));

const invitation = {
  ok: true, email: 'a@test.com', onboardingUrl: 'https://x/onboarding', expiresAt: '2026-11-30T00:00:00Z',
  hasAccount: true, emailSent: true,
};

async function submit() {
  render(<InviteRestaurantModal onClose={jest.fn()} initialEmail="a@test.com" />);
  fireEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
  await waitFor(() => expect(screen.getByText('Lien d’invitation')).toBeTruthy());
}

beforeEach(() => jest.clearAllMocks());

it('invitation non journalisée : toast d erreur', async () => {
  (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, auditLogged: false });
  await submit();
  expect(toast).toHaveBeenCalledWith(
    expect.stringMatching(/n'a pas pu être journalisée\. Prévenez l'équipe technique\./), 'error');
});

it('invitation journalisée : pas de toast d erreur', async () => {
  (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, auditLogged: true });
  await submit();
  expect(toast).not.toHaveBeenCalled();
});
