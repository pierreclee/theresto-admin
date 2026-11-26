// Parcours accompagné : invitation de 2 heures sans e-mail, lien et QR code affichés à l'admin.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AccompaniedOnboardingModal,
  invitationQrDataUrl,
} from '@/components/restaurants/AccompaniedOnboardingModal';
import { inviteRestaurantOwnerAction, searchTwentyCompaniesAction } from '@/lib/actions/invitations';

jest.mock('@/lib/actions/invitations', () => ({
  inviteRestaurantOwnerAction: jest.fn(),
  searchTwentyCompaniesAction: jest.fn(),
}));
// Matrice et dessin du QR : lib/links/qrCode.ts, testés par qrCode.test.ts et qrReadability.test.ts.
const buildQrMatrix = jest.fn((text: string) => ({ text }));
jest.mock('@/lib/links/qrCode', () => ({
  buildQrMatrix: (text: string, options: unknown) => buildQrMatrix(text, options),
  qrSvg: (matrix: { text: string }) => `<svg data-text="${matrix.text}"></svg>`,
}));
const toast = jest.fn();
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => toast }));

const url = 'https://hub.theresto.fr/signup?email=a%40test.com&redirect=%2Fonboarding%2Ftok';
const invitation = {
  ok: true, email: 'a@test.com', onboardingUrl: url, expiresAt: '2026-12-06T12:00:00Z',
  hasAccount: false, emailSent: false, mode: 'accompanied', auditLogged: true,
};

async function launch() {
  render(<AccompaniedOnboardingModal onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Adresse e-mail du restaurateur'), { target: { value: ' a@test.com ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer le lien' }));
  await waitFor(() => expect(screen.getByLabelText('Lien d’inscription')).toBeTruthy());
}

beforeEach(() => jest.clearAllMocks());

it('demande une invitation accompagnée et affiche le lien et le QR code', async () => {
  (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue(invitation);
  await launch();
  expect(inviteRestaurantOwnerAction).toHaveBeenCalledWith('a@test.com', 'accompanied');
  expect((screen.getByLabelText('Lien d’inscription') as HTMLInputElement).value).toBe(url);
  const img = screen.getByAltText('QR code du lien d’inscription') as HTMLImageElement;
  expect(img.src.startsWith('data:image/svg+xml')).toBe(true);
  expect(screen.getByText(/Valable 2 heures/)).toBeTruthy();
  expect(screen.getByRole('link', { name: /Ouvrir/ }).getAttribute('href')).toBe(url);
  expect(toast).not.toHaveBeenCalled();
});

it('journal en échec : toast d erreur', async () => {
  (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, auditLogged: false });
  await launch();
  expect(toast).toHaveBeenCalledWith(expect.stringMatching(/n'a pas pu être journalisé/), 'error');
});

it('refus de l Edge Function : message affiché', async () => {
  (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ok: false, error: 'Ce compte est déjà rattaché à un restaurant.' });
  render(<AccompaniedOnboardingModal onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Adresse e-mail du restaurateur'), { target: { value: 'a@test.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer le lien' }));
  await waitFor(() => expect(screen.getByText('Ce compte est déjà rattaché à un restaurant.')).toBeTruthy());
});

it('QR code : image SVG du lien exact, sans logo, dessinée dans le navigateur', () => {
  const dataUrl = invitationQrDataUrl(url);
  expect(dataUrl).not.toBeNull();
  expect(buildQrMatrix).toHaveBeenCalledWith(url, { withLogo: false });
  expect(decodeURIComponent(dataUrl!.split(',')[1])).toContain('<svg');
});

describe('fonction du serveur pas à jour (mode absent ou « email »)', () => {
  async function launchOutdated(response: Record<string, unknown>) {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue(response);
    const onInvited = jest.fn();
    render(<AccompaniedOnboardingModal onClose={jest.fn()} onInvited={onInvited} />);
    fireEvent.change(screen.getByLabelText('Adresse e-mail du restaurateur'), { target: { value: 'a@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    return onInvited;
  }

  it('mode absent : ni lien ni QR, message honnête sur l e-mail classique, pas de nouvel essai', async () => {
    const { mode: _mode, ...withoutMode } = invitation;
    void _mode;
    const onInvited = await launchOutdated({ ...withoutMode, emailSent: false });
    const alert = screen.getByRole('alert').textContent ?? '';
    expect(alert).toMatch(/n’est pas accompagnée : la fonction du serveur \(admin-onboarding\) n’est pas à jour/);
    expect(alert).toMatch(/Une invitation classique \(e-mail, 7 jours\) a peut-être été envoyée à a@test\.com/);
    expect(screen.queryByLabelText('Lien d’inscription')).toBeNull();
    expect(screen.queryByAltText('QR code du lien d’inscription')).toBeNull();
    expect(buildQrMatrix).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Créer le lien' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onInvited).toHaveBeenCalledTimes(1);
  });

  it('mode « email » et e-mail envoyé : le message le dit', async () => {
    await launchOutdated({ ...invitation, mode: 'email', emailSent: true });
    expect(screen.getByRole('alert').textContent).toMatch(/a été envoyée à a@test\.com/);
    expect(screen.queryByLabelText('Lien d’inscription')).toBeNull();
  });
});

it('adresse préremplie : verrouillée, envoyée telle quelle, onInvited appelé', async () => {
  (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue(invitation);
  const onInvited = jest.fn();
  render(<AccompaniedOnboardingModal onClose={jest.fn()} initialEmail="a@test.com" onInvited={onInvited} />);
  const input = screen.getByLabelText('Adresse e-mail du restaurateur') as HTMLInputElement;
  expect(input.readOnly).toBe(true);
  expect(input.value).toBe('a@test.com');
  fireEvent.click(screen.getByRole('button', { name: 'Créer le lien' }));
  await waitFor(() => expect(screen.getByLabelText('Lien d’inscription')).toBeTruthy());
  expect(inviteRestaurantOwnerAction).toHaveBeenCalledWith('a@test.com', 'accompanied');
  expect(onInvited).toHaveBeenCalledTimes(1);
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
  it('fiche et accord transmis, résultat affiché', async () => {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, prefill: { siren: true, photo: 'ok' } });
    render(<AccompaniedOnboardingModal onClose={jest.fn()} initialEmail="a@test.com" />);
    await pickHygge(true);
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien' }));
    await waitFor(() => expect(screen.getByLabelText('Lien d’inscription')).toBeTruthy());
    expect(inviteRestaurantOwnerAction).toHaveBeenCalledWith('a@test.com', 'accompanied', {
      twentyCompanyId: 'c1', photoConsent: true,
    });
    const summary = screen.getByRole('list', { name: 'Préremplissage' });
    expect(summary.textContent).toContain('SIREN prérempli');
    expect(summary.textContent).toContain('Photo préremplie');
  });

  it('case non cochée : photoConsent false, raison affichée', async () => {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, prefill: { siren: false, photo: 'no-consent' } });
    render(<AccompaniedOnboardingModal onClose={jest.fn()} initialEmail="a@test.com" />);
    await pickHygge(false);
    fireEvent.click(screen.getByRole('button', { name: 'Créer le lien' }));
    await waitFor(() => expect(screen.getByLabelText('Lien d’inscription')).toBeTruthy());
    expect(inviteRestaurantOwnerAction).toHaveBeenCalledWith('a@test.com', 'accompanied', {
      twentyCompanyId: 'c1', photoConsent: false,
    });
    expect(screen.getByText('Photo non préremplie : le restaurateur n’a pas donné son accord')).toBeTruthy();
  });

  it('sans fiche : aucun résultat de préremplissage affiché', async () => {
    (inviteRestaurantOwnerAction as jest.Mock).mockResolvedValue({ ...invitation, prefill: null });
    await launch();
    expect(screen.queryByRole('list', { name: 'Préremplissage' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
