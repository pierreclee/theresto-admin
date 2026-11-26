// Fiche du restaurant : état du Kbis (contrat : docs/features/onboarding-accompagne.md de l'app).
// Jamais d'après kbis_path seul : la conservation le vide après la validation ou le refus.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KbisRow, kbisState } from '@/components/restaurants/RestaurantDetail';
import type { Restaurant } from '@/lib/types/restaurant';

const getKbisUrl = jest.fn();
jest.mock('@/lib/api/admin', () => ({ adminApi: { getKbisUrl: (id: string) => getKbisUrl(id) } }));
jest.mock('@/lib/api/users', () => ({ usersApi: {} }));
jest.mock('@/lib/hooks/useCommissionSettings', () => ({ useRestaurantCommission: () => ({}) }));

const base = {
  id: 'r1', name: 'Chez Paul', email: 'contact@chezpaul.fr', approval_status: 'pending',
  subscription_plan: 'essentiel', is_mollie_connected: false, commission_rate: 0,
} as Restaurant;

describe('kbisState', () => {
  it.each([
    ['fichier enregistré', { kbis_path: 'u1/kbis_1.pdf', kbis_required_later: false }, 'available'],
    ['fichier enregistré, drapeau incohérent : le fichier l emporte', { kbis_path: 'u1/k.pdf', kbis_required_later: true }, 'available'],
    ['parcours accompagné sans Kbis', { kbis_path: null, kbis_required_later: true }, 'expected'],
    ['attendu même après validation', { kbis_required_later: true, approval_approved_at: '2026-12-01T10:00:00Z' }, 'expected'],
    ['retiré après validation', { kbis_path: null, kbis_required_later: false, approval_approved_at: '2026-10-01T10:00:00Z' }, 'removed'],
    ['retiré après refus', { kbis_path: null, approval_rejected_at: '2026-01-01T10:00:00Z' }, 'removed'],
    ['retiré après un dépôt', { kbis_path: null, kbis_submitted_at: '2026-10-01T10:00:00Z' }, 'removed'],
    ['jamais fourni ni décidé', { kbis_path: null, kbis_required_later: false }, 'missing'],
    ['colonnes absentes (fonction pas à jour)', {}, 'missing'],
  ])('%s', (_label, fields, expected) => {
    expect(kbisState({ ...base, ...fields } as Restaurant)).toBe(expected);
  });
});

describe('KbisRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Kbis enregistré : « Voir le Kbis » et date du dépôt', async () => {
    getKbisUrl.mockResolvedValue({ ok: false, error: 'Aucun Kbis déposé' });
    jest.spyOn(window, 'open').mockReturnValue(null);
    render(<KbisRow restaurant={{ ...base, kbis_path: 'u1/k.pdf', kbis_submitted_at: '2026-12-06T10:00:00Z' }} />);
    expect(screen.getByText('Déposé le 6 décembre 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voir le Kbis' }));
    await waitFor(() => expect(getKbisUrl).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('Aucun Kbis déposé')).toBeTruthy();
  });

  it('Kbis d avant kbis_submitted_at : pas de date', () => {
    render(<KbisRow restaurant={{ ...base, kbis_path: 'u1/k.pdf' }} />);
    expect(screen.getByRole('button', { name: 'Voir le Kbis' })).toBeTruthy();
    expect(screen.queryByText(/Déposé le/)).toBeNull();
  });

  it.each([
    [{ kbis_required_later: true }, 'Non fourni (à déposer par le restaurateur depuis le Hub)'],
    [{ approval_approved_at: '2026-10-01T10:00:00Z' }, 'Retiré (durée de conservation écoulée)'],
    [{}, 'Non fourni'],
  ])('sans fichier : %o', (fields, label) => {
    render(<KbisRow restaurant={{ ...base, kbis_path: null, ...fields }} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Voir le Kbis' })).toBeNull();
  });
});
