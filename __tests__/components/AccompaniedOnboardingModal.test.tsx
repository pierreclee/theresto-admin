// Parcours accompagné : invitation de 2 heures sans e-mail, lien et QR code affichés à l'admin.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AccompaniedOnboardingModal,
  invitationQrDataUrl,
} from '@/components/restaurants/AccompaniedOnboardingModal';
import { inviteRestaurantOwnerAction } from '@/lib/actions/invitations';

jest.mock('@/lib/actions/invitations', () => ({ inviteRestaurantOwnerAction: jest.fn() }));
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
