/**
 * @jest-environment node
 *
 * Préremplissage depuis Twenty : corps exact envoyé à l'Edge Function admin-onboarding
 * (fiche et accord photo seulement si une fiche est choisie), réponses lues défensivement,
 * refus traduits (twenty-unavailable, invalid-query…), sous les deux formes de réponse.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

const invoke = jest.fn();
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1' }),
  createClient: jest.fn(async () => ({ functions: { invoke } })),
  getAdminClient: jest.fn(),
}));

import { requireAdmin } from '@/lib/supabase/server';
import { inviteRestaurantOwnerAction, searchTwentyCompaniesAction } from '@/lib/actions/invitations';
import { ADMIN_LOG_FAILED_MESSAGE } from '@/lib/audit/messages';
import {
  parsePrefillResult,
  prefillLines,
  PREFILL_PHOTO_OUTCOMES,
  TWENTY_INVALID_QUERY_MESSAGE,
  TWENTY_UNAVAILABLE_MESSAGE,
} from '@/lib/utils/twentyPrefill';

const COMPANY_ID = '0b9a4c8e-3f1d-4a2b-9c7e-5d6f7a8b9c0d';
const invitation = {
  email: 'a@test.com', onboardingUrl: 'https://hub/onboarding/t', expiresAt: '2026-12-01T00:00:00Z',
  hasAccount: true, emailSent: true, mode: 'email', auditLogged: true,
};

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  invoke.mockReset();
  (requireAdmin as jest.Mock).mockClear();
});

describe('inviteRestaurantOwnerAction', () => {
  it('sans fiche : corps inchangé, ni twentyCompanyId ni photoConsent, prefill null', async () => {
    invoke.mockResolvedValue({ data: { data: invitation }, error: null });
    const result = await inviteRestaurantOwnerAction('a@test.com', 'accompanied');
    expect(requireAdmin).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('admin-onboarding', {
      body: { action: 'createRestaurantInvitation', email: 'a@test.com', mode: 'accompanied' },
    });
    expect(result).toEqual({ ok: true, ...invitation, prefill: null });
  });

  it('avec fiche : identifiant et accord photo transmis tels quels', async () => {
    invoke.mockResolvedValue({ data: { data: { ...invitation, prefill: { siren: true, photo: 'ok' } } }, error: null });
    const result = await inviteRestaurantOwnerAction('a@test.com', 'email', { twentyCompanyId: COMPANY_ID, photoConsent: true });
    expect(invoke).toHaveBeenCalledWith('admin-onboarding', {
      body: {
        action: 'createRestaurantInvitation', email: 'a@test.com', mode: 'email',
        twentyCompanyId: COMPANY_ID, photoConsent: true,
      },
    });
    expect(result.ok && result.prefill).toEqual({ siren: true, photo: 'ok' });
  });

  it('accord photo non booléen : false', async () => {
    invoke.mockResolvedValue({ data: { data: { ...invitation, prefill: { siren: false, photo: 'no-consent' } } }, error: null });
    await inviteRestaurantOwnerAction('a@test.com', 'email', {
      twentyCompanyId: COMPANY_ID, photoConsent: 'yes' as unknown as boolean,
    });
    expect(invoke.mock.calls[0][1].body.photoConsent).toBe(false);
  });

  it('mode inconnu : email', async () => {
    invoke.mockResolvedValue({ data: { data: invitation }, error: null });
    await inviteRestaurantOwnerAction('a@test.com', 'autre' as never);
    expect(invoke.mock.calls[0][1].body.mode).toBe('email');
  });

  it.each([
    ['imbriquée', { error: { code: 'twenty-unavailable', message: 'CRM Twenty indisponible.' } }],
    ['à plat', { code: 'twenty-unavailable', error: 'CRM Twenty indisponible.' }],
  ])('503 twenty-unavailable (réponse %s) : refus avec code et message', async (_label, body) => {
    invoke.mockResolvedValue({ data: null, error: httpError(503, body) });
    await expect(inviteRestaurantOwnerAction('a@test.com', 'email', { twentyCompanyId: COMPANY_ID, photoConsent: false }))
      .resolves.toEqual({ ok: false, code: 'twenty-unavailable', error: TWENTY_UNAVAILABLE_MESSAGE });
  });

  it.each(['company-not-found', 'invalid-company'])('%s : message en français, code gardé', async (code) => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(code === 'invalid-company' ? 400 : 404, { error: { code, message: 'x' } }),
    });
    const result = await inviteRestaurantOwnerAction('a@test.com', 'email', { twentyCompanyId: COMPANY_ID, photoConsent: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(code);
      expect(result.error).toMatch(/Fiche Twenty/);
    }
  });

  it('autre refus : message de la fonction', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(412, { error: { code: 'failed-precondition', message: 'Ce compte est déjà rattaché à un restaurant.' } }),
    });
    await expect(inviteRestaurantOwnerAction('a@test.com')).resolves.toEqual({
      ok: false, code: 'failed-precondition', error: 'Ce compte est déjà rattaché à un restaurant.',
    });
  });
});

describe('searchTwentyCompaniesAction', () => {
  it('requête nettoyée, fiches lues défensivement', async () => {
    invoke.mockResolvedValue({
      data: {
        data: {
          companies: [
            { id: 'c1', name: 'Hygge', city: 'Rouen', sirenValidated: true, photoValidated: true,
              photoLabel: 'Google Maps - devanture (1600x1200)', photoUrl: 'https://lh3.googleusercontent.com/p/x' },
            // Photo non validée : ni libellé ni URL gardés.
            { id: 'c2', name: 'Le Rouennais', city: null, sirenValidated: false, photoValidated: false,
              photoLabel: 'x', photoUrl: 'https://lh3.googleusercontent.com/p/y' },
            // URL non https : lien retiré.
            { id: 'c3', name: 'Bistro', city: 'Caen', sirenValidated: false, photoValidated: true,
              photoLabel: null, photoUrl: 'javascript:alert(1)' },
            { id: '', name: 'sans id' },
            null,
          ],
        },
      },
      error: null,
    });
    const result = await searchTwentyCompaniesAction('  Hyg  ');
    expect(requireAdmin).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('admin-onboarding', { body: { action: 'searchTwentyCompanies', query: 'Hyg' } });
    expect(result).toEqual({
      ok: true,
      companies: [
        { id: 'c1', name: 'Hygge', city: 'Rouen', sirenValidated: true, photoValidated: true,
          photoLabel: 'Google Maps - devanture (1600x1200)', photoUrl: 'https://lh3.googleusercontent.com/p/x' },
        { id: 'c2', name: 'Le Rouennais', city: null, sirenValidated: false, photoValidated: false,
          photoLabel: null, photoUrl: null },
        { id: 'c3', name: 'Bistro', city: 'Caen', sirenValidated: false, photoValidated: true,
          photoLabel: null, photoUrl: null },
      ],
    });
  });

  it.each(['a', ' a ', 'x'.repeat(81)])('requête %j hors limites : aucun appel', async (q) => {
    await expect(searchTwentyCompaniesAction(q)).resolves.toEqual({
      ok: false, code: 'invalid-query', error: TWENTY_INVALID_QUERY_MESSAGE,
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(requireAdmin).toHaveBeenCalled();
  });

  it('503 twenty-unavailable', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(503, { error: { code: 'twenty-unavailable', message: 'CRM Twenty indisponible.' } }),
    });
    await expect(searchTwentyCompaniesAction('Hygge')).resolves.toEqual({
      ok: false, code: 'twenty-unavailable', error: TWENTY_UNAVAILABLE_MESSAGE,
    });
  });

  it('503 audit-log-failed : refus du journal', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(503, { error: { code: 'audit-log-failed', message: 'x' } }) });
    await expect(searchTwentyCompaniesAction('Hygge')).resolves.toEqual({
      ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE,
    });
  });

  it('réponse sans liste : aucune fiche', async () => {
    invoke.mockResolvedValue({ data: { data: null }, error: null });
    await expect(searchTwentyCompaniesAction('Hygge')).resolves.toEqual({ ok: true, companies: [] });
  });
});

describe('résultat du préremplissage', () => {
  it('lecture défensive', () => {
    expect(parsePrefillResult(null)).toBeNull();
    expect(parsePrefillResult(undefined)).toBeNull();
    expect(parsePrefillResult({ siren: 'oui', photo: 'inconnu' })).toEqual({ siren: false, photo: 'failed' });
  });

  it('une ligne pour le SIREN et une pour la photo, chaque issue traduite', () => {
    expect(prefillLines({ siren: true, photo: 'ok' })).toEqual([
      { ok: true, text: 'SIREN prérempli' },
      { ok: true, text: 'Photo préremplie' },
    ]);
    const texts = PREFILL_PHOTO_OUTCOMES.map((photo) => prefillLines({ siren: false, photo })[1].text);
    expect(new Set(texts).size).toBe(PREFILL_PHOTO_OUTCOMES.length);
    for (const text of texts.slice(1)) expect(text).toMatch(/^Photo non préremplie : /);
    expect(prefillLines({ siren: false, photo: 'none' })[0]).toEqual({
      ok: false, text: expect.stringMatching(/^SIREN non prérempli/),
    });
  });
});
