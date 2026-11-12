/**
 * @jest-environment node
 *
 * Versions de l'app mobile (P10) : saisie validée comme l'Edge Function app-version-settings,
 * avertissement quand le minimum monte, erreurs traduites, corps transmis à la fonction.
 */
const invokeEdgeFunction = jest.fn();
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1' }),
  createClient: jest.fn(),
  getAdminClient: jest.fn(),
}));
jest.mock('@/lib/supabase/invokeFunction', () => ({ invokeEdgeFunction: (...a: unknown[]) => invokeEdgeFunction(...a) }));

import { requireAdmin } from '@/lib/supabase/server';
import { getAppVersionPoliciesAction, updateAppVersionPolicyAction } from '@/lib/actions/appVersionSettings';
import {
  APP_VERSION_CONFLICT_MESSAGE,
  appVersionErrorMessage,
  compareAppVersions,
  draftRaisesMinimum,
  isConflict,
  isMfaRefusal,
  parseAppVersionDraft,
  raisesMinimum,
  type AppVersionDraft,
} from '@/lib/utils/appVersion';

const T0 = '2026-11-27T10:00:00.123456+00:00';
const draft: AppVersionDraft = {
  minVersion: '1.2.0', minBuild: '12', recommendedVersion: '1.3.0', recommendedBuild: '14',
  message: '  Une mise à jour importante est disponible.  ',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.theresto.application',
};

describe('comparaison des versions', () => {
  it('x.y.z numériquement, puis le build', () => {
    expect(compareAppVersions('1.10.0', 1, '1.9.9', 99)).toBeGreaterThan(0);
    expect(compareAppVersions('1.2.0', 12, '1.2.0', 13)).toBeLessThan(0);
    expect(compareAppVersions('1.2.0', 12, '1.2.0', 12)).toBe(0);
  });

  it('relever le minimum est détecté (avertissement)', () => {
    const current = { minVersion: '1.0.0', minBuild: 1 };
    expect(raisesMinimum(current, { minVersion: '1.0.0', minBuild: 2 })).toBe(true);
    expect(raisesMinimum(current, { minVersion: '1.0.0', minBuild: 1 })).toBe(false);
    expect(raisesMinimum({ minVersion: '1.2.0', minBuild: 12 }, { minVersion: '1.1.0', minBuild: 20 })).toBe(false);
    expect(draftRaisesMinimum(current, { minVersion: '1.2', minBuild: '3' })).toBe(false);
    expect(draftRaisesMinimum(current, { minVersion: '1.2.0', minBuild: '3' })).toBe(true);
  });
});

describe('saisie', () => {
  it('corps complet de updateAppVersionPolicy', () => {
    expect(parseAppVersionDraft('android', draft, T0)).toEqual({
      ok: true,
      value: {
        platform: 'android', minVersion: '1.2.0', minBuild: 12, recommendedVersion: '1.3.0', recommendedBuild: 14,
        message: 'Une mise à jour importante est disponible.', storeUrl: draft.storeUrl, expectedUpdatedAt: T0,
      },
    });
  });

  it('message et lien vides → null (retirés), accepté en 1.0.0 build 1', () => {
    const r = parseAppVersionDraft('ios', { minVersion: '1.0.0', minBuild: '1', recommendedVersion: '1.0.0', recommendedBuild: '1', message: ' ', storeUrl: '' }, T0);
    expect(r.ok && [r.value.message, r.value.storeUrl]).toEqual([null, null]);
  });

  it.each([
    [{ minVersion: '1.2' }, 'Version minimale'],
    [{ recommendedVersion: '1.2.0.1' }, 'Version recommandée'],
    [{ minBuild: '0' }, 'Build minimal'],
    [{ recommendedBuild: '2100000001' }, 'Build recommandé'],
    [{ recommendedVersion: '1.1.0' }, 'inférieure'],
    [{ message: 'x'.repeat(501) }, 'Message'],
    [{ storeUrl: 'https://apps.apple.com/fr/app/x' }, 'https://play.google.com/'],
    [{ storeUrl: '' }, 'obligatoire'],
  ])('%o refusé', (patch, text) => {
    const r = parseAppVersionDraft('android', { ...draft, ...patch }, T0);
    expect(!r.ok && r.error).toContain(text);
  });
});

describe('erreurs de l Edge Function', () => {
  it.each([
    ['permission-denied', 'nouveau code'],
    ['conflict', APP_VERSION_CONFLICT_MESSAGE],
    ['audit-log-failed', 'Modification annulée'],
    ['invalid-argument', 'Valeurs refusées'],
    ['unauthenticated', 'Session expirée'],
    ['internal', 'a échoué'],
  ])('%s', (code, text) => expect(appVersionErrorMessage(code)).toContain(text));

  it('refus MFA et conflit reconnus', () => {
    expect(isMfaRefusal('permission-denied')).toBe(true);
    expect(isConflict('conflict')).toBe(true);
    expect(isConflict('failed-precondition')).toBe(true);
    expect(isConflict('invalid-argument')).toBe(false);
  });
});

describe('actions serveur', () => {
  beforeEach(() => invokeEdgeFunction.mockReset().mockResolvedValue({ ok: true, data: {} }));

  it('lecture : action getAppVersionPolicies', async () => {
    await getAppVersionPoliciesAction();
    expect(invokeEdgeFunction).toHaveBeenCalledWith('app-version-settings', { action: 'getAppVersionPolicies' });
  });

  it('modification : champs du contrat seulement, message et lien toujours présents', async () => {
    const parsed = parseAppVersionDraft('ios', { ...draft, message: '', storeUrl: 'https://apps.apple.com/fr/app/theresto/id1' }, T0);
    if (!parsed.ok) throw new Error(parsed.error);
    await updateAppVersionPolicyAction({ ...parsed.value, extra: 'x' } as never);
    expect(invokeEdgeFunction).toHaveBeenCalledWith('app-version-settings', {
      action: 'updateAppVersionPolicy', platform: 'ios', minVersion: '1.2.0', minBuild: 12,
      recommendedVersion: '1.3.0', recommendedBuild: 14, message: null,
      storeUrl: 'https://apps.apple.com/fr/app/theresto/id1', expectedUpdatedAt: T0,
    });
  });

  it('refus de requireAdmin : la fonction n est pas appelée', async () => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getAppVersionPoliciesAction()).rejects.toThrow();
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });
});
