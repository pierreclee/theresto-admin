import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdatePlatformStatus } from '@/lib/hooks/usePlatformStatus';
import { updatePlatformStatusAction } from '@/lib/actions/platformStatusSettings';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { ActionError } from '@/lib/api/actionResult';
import { isNetworkFailure, PLATFORM_STATUS_NETWORK_MESSAGE } from '@/lib/utils/platformStatus';
import type { PlatformStatusInput } from '@/lib/types/platformStatus';

// Coupure réseau pendant l'enregistrement : message en français, jamais « Failed to fetch ».

jest.mock('@/lib/actions/platformStatusSettings', () => ({
  getPlatformStatusAction: jest.fn(),
  getMaintenancePeriodsAction: jest.fn(),
  updatePlatformStatusAction: jest.fn(),
}));
jest.mock('@/lib/auth/verifyTotp', () => ({ verifyTotpCode: jest.fn() }));
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => jest.fn() }));

const update = updatePlatformStatusAction as jest.Mock;
const verify = verifyTotpCode as jest.Mock;
const input = (): PlatformStatusInput => ({
  enabled: false, level: 'clients', startsAt: null, endsAt: null, message: null, expectedUpdatedAt: 'v1',
});

function hook() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUpdatePlatformStatus(), { wrapper }).result;
}

describe('useUpdatePlatformStatus : erreurs réseau', () => {
  beforeEach(() => {
    update.mockReset();
    verify.mockReset().mockResolvedValue(undefined);
  });

  it.each([
    ['Chrome', new TypeError('Failed to fetch')],
    ['Node', new TypeError('fetch failed')],
    ['Firefox', new TypeError('NetworkError when attempting to fetch resource.')],
    ['Safari', new TypeError('Load failed')],
  ])('action serveur injoignable (%s) : message en français', async (_name, error) => {
    update.mockRejectedValue(error);
    await expect(hook().current.mutateAsync({ totpCode: '123456', input })).rejects.toMatchObject({
      message: PLATFORM_STATUS_NETWORK_MESSAGE, code: 'network',
    });
  });

  it('vérification du code injoignable : message en français', async () => {
    verify.mockRejectedValue(new Error('Failed to fetch'));
    await expect(hook().current.mutateAsync({ totpCode: '123456', input })).rejects.toMatchObject({
      message: PLATFORM_STATUS_NETWORK_MESSAGE,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('code faux et refus de la fonction : messages inchangés', async () => {
    verify.mockRejectedValueOnce(new Error('Code de vérification invalide'));
    await expect(hook().current.mutateAsync({ totpCode: '000000', input })).rejects.toThrow('Code de vérification invalide');
    update.mockResolvedValueOnce({ ok: false, code: 'conflict', error: 'stale' });
    const e = await hook().current.mutateAsync({ totpCode: '123456', input }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ActionError);
    expect((e as ActionError).code).toBe('conflict');
  });

  it('isNetworkFailure : seulement les erreurs de réseau', () => {
    expect(isNetworkFailure(Object.assign(new Error('x'), { name: 'AuthRetryableFetchError' }))).toBe(true);
    expect(isNetworkFailure(new Error('Code de vérification invalide'))).toBe(false);
    expect(isNetworkFailure('Failed to fetch')).toBe(false);
  });
});
