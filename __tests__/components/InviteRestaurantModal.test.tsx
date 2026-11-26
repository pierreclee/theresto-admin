// RGPD-29 (lot 9, D2) : l'invitation est journalisée par l'Edge Function admin-onboarding ;
// auditLogged=false (invitation faite, journal en échec) est signalé par un toast d'erreur.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InviteRestaurantModal } from '@/components/restaurants/InviteRestaurantModal';
import { inviteRestaurantOwnerAction, searchTwentyCompaniesAction } from '@/lib/actions/invitations';

jest.mock('@/lib/actions/invitations', () => ({
  inviteRestaurantOwnerAction: jest.fn(),
  searchTwentyCompaniesAction: jest.fn(),
}));
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

// Fiche Twenty facultative : choisie dans le sélecteur, transmise avec l'accord photo,
// résultat du préremplissage affiché après la création.
const hygge = {
  id: 'c1', name: 'Hygge', city: 'Rouen', sirenValidated: true, photoValidated: true,
  photoLabel: 'Google Maps', photoUrl: 'https://lh3.googleusercontent.com/p/x',
};

async function pickHygge(consent: boolean) {
  (searchTwentyCompaniesAction as jest.Mock).mockResolvedValue({ ok: true, companies: [hygge] });
  fireEvent.change(screen.getByLabelText('Fiche Twenty (facultatif)'), { target: { value: 'Hyg' } });
  fireEvent.click((await screen.findAllByRole('option'))[0]);
  if (consent) fireEvent.click(screen.getByLabelText(/Le restaurateur accepte/));
}

describe('préremplissage depuis Twenty', () => {
  it('fiche et accord transmis (parcours e-mail), résultat affiché', async () => {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, prefill: { siren: true, photo: 'refused-host' } });
    render(<InviteRestaurantModal onClose={jest.fn()} initialEmail="a@test.com" />);
    await pickHygge(true);
    fireEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    await waitFor(() => expect(screen.getByText('Lien d’invitation')).toBeTruthy());
    expect(inviteRestaurantOwnerAction).toHaveBeenCalledWith('a@test.com', 'email', {
      twentyCompanyId: 'c1', photoConsent: true,
    });
    const summary = screen.getByRole('list', { name: 'Préremplissage' });
    expect(summary.textContent).toContain('SIREN prérempli');
    expect(summary.textContent).toContain('Photo non préremplie : l’hébergeur de l’image n’est pas autorisé');
  });

  it('sans fiche : appel inchangé', async () => {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, prefill: null });
    await submit();
    expect(inviteRestaurantOwnerAction).toHaveBeenCalledWith('a@test.com');
    expect(screen.queryByRole('list', { name: 'Préremplissage' })).toBeNull();
  });

  it('fonction pas à jour (pas de prefill) : avertissement', async () => {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation });
    render(<InviteRestaurantModal onClose={jest.fn()} initialEmail="a@test.com" />);
    await pickHygge(false);
    fireEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Préremplissage non appliqué/));
  });

  it('fiche introuvable : refus affiché, aucune invitation', async () => {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({
      ok: false, code: 'company-not-found', error: 'Fiche Twenty introuvable (supprimée ?) : retirez-la et choisissez-en une autre.',
    });
    render(<InviteRestaurantModal onClose={jest.fn()} initialEmail="a@test.com" />);
    await pickHygge(false);
    fireEvent.click(screen.getByRole('button', { name: "Envoyer l'invitation" }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Fiche Twenty introuvable/));
  });
});
