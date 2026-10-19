import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCommissionSettings,
  useRestaurantCommission,
  useSetRestaurantOnlineRate,
  useUpdateGlobalOnlineRates,
} from '@/lib/hooks/useCommissionSettings';
import {
  getCommissionSettingsAction,
  getRestaurantCommissionAction,
  setRestaurantOnlineRateAction,
  updateGlobalOnlineRatesAction,
} from '@/lib/actions/commissionSettings';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { COMMISSION_CONFLICT_MESSAGE, CommissionMutationError } from '@/lib/utils/commissionRates';

jest.mock('@/lib/actions/commissionSettings', () => ({
  getCommissionSettingsAction: jest.fn(),
  getRestaurantCommissionAction: jest.fn(),
  resetRestaurantCommissionRatesAction: jest.fn(),
  updateGlobalCommissionRatesAction: jest.fn(),
  updateRestaurantCommissionRatesAction: jest.fn(),
  updateGlobalOnlineRatesAction: jest.fn(),
  setRestaurantOnlineRateAction: jest.fn(),
}));
jest.mock('@/lib/auth/verifyTotp', () => ({ verifyTotpCode: jest.fn() }));
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => jest.fn() }));

const getSettings = getCommissionSettingsAction as jest.Mock;
const getRestaurant = getRestaurantCommissionAction as jest.Mock;
const updateGlobalOnline = updateGlobalOnlineRatesAction as jest.Mock;
const setRestaurantOnline = setRestaurantOnlineRateAction as jest.Mock;
const verifyTotp = verifyTotpCode as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('lecture des commissions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it("remplace un message d'erreur brut par un message en français", async () => {
    getSettings.mockResolvedValue({ ok: false, code: 'internal', error: 'Internal server error' });
    const { result } = renderHook(() => useCommissionSettings(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Impossible de charger les commissions.');
  });

  it("traduit l'échec de l'action serveur elle-même", async () => {
    getSettings.mockRejectedValue(new Error('Unauthorized'));
    const { result } = renderHook(() => useCommissionSettings(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Impossible de charger les commissions.');
  });

  it('signale un restaurant introuvable', async () => {
    getRestaurant.mockResolvedValue({ ok: false, code: 'not-found', error: 'Restaurant not found' });
    const { result } = renderHook(() => useRestaurantCommission('r1'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Restaurant introuvable.');
  });

  it("n'interroge pas le serveur sans identifiant de restaurant", () => {
    renderHook(() => useRestaurantCommission(''), { wrapper });
    expect(getRestaurant).not.toHaveBeenCalled();
  });
});

describe('taux des paiements en ligne', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('useUpdateGlobalOnlineRates vérifie le code puis envoie les taux sans totpCode', async () => {
    verifyTotp.mockResolvedValue(undefined);
    updateGlobalOnline.mockResolvedValue({ ok: true, data: { updatedAt: 'x', auditLogged: true } });
    const { result } = renderHook(() => useUpdateGlobalOnlineRates(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        croissanceRate: 4,
        liberteRate: 3,
        expectedUpdatedAt: '2026-10-18T10:00:00Z',
        totpCode: '123456',
      });
    });
    expect(verifyTotp).toHaveBeenCalledWith('123456');
    expect(verifyTotp.mock.invocationCallOrder[0]).toBeLessThan(updateGlobalOnline.mock.invocationCallOrder[0]);
    expect(updateGlobalOnline).toHaveBeenCalledWith({
      croissanceRate: 4,
      liberteRate: 3,
      expectedUpdatedAt: '2026-10-18T10:00:00Z',
    });
  });

  it('useUpdateGlobalOnlineRates signale un conflit de concurrence', async () => {
    verifyTotp.mockResolvedValue(undefined);
    updateGlobalOnline.mockResolvedValue({ ok: false, code: 'failed-precondition', error: 'conflict' });
    const { result } = renderHook(() => useUpdateGlobalOnlineRates(), { wrapper });
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          croissanceRate: 4,
          liberteRate: 3,
          expectedUpdatedAt: 'old',
          totpCode: '123456',
        });
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeInstanceOf(CommissionMutationError);
    expect((caught as CommissionMutationError).isConflict).toBe(true);
    expect((caught as CommissionMutationError).message).toBe(COMMISSION_CONFLICT_MESSAGE);
  });

  it("useUpdateGlobalOnlineRates n'appelle pas l'action si le code TOTP est refusé", async () => {
    verifyTotp.mockRejectedValue(new Error('Code invalide'));
    const { result } = renderHook(() => useUpdateGlobalOnlineRates(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ croissanceRate: 4, liberteRate: 3, expectedUpdatedAt: 'x', totpCode: '000000' })
        .catch(() => undefined);
    });
    expect(updateGlobalOnline).not.toHaveBeenCalled();
  });

  it('useSetRestaurantOnlineRate envoie le taux particulier', async () => {
    verifyTotp.mockResolvedValue(undefined);
    setRestaurantOnline.mockResolvedValue({ ok: true, data: { updatedAt: 'x', auditLogged: true } });
    const { result } = renderHook(() => useSetRestaurantOnlineRate('r1'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ rate: 7.25, expectedUpdatedAt: null, totpCode: '123456' });
    });
    expect(setRestaurantOnline).toHaveBeenCalledWith({ restaurantId: 'r1', rate: 7.25, expectedUpdatedAt: null });
  });

  it('useSetRestaurantOnlineRate envoie rate null pour revenir au taux du plan', async () => {
    verifyTotp.mockResolvedValue(undefined);
    setRestaurantOnline.mockResolvedValue({ ok: true, data: { updatedAt: 'x', auditLogged: true } });
    const { result } = renderHook(() => useSetRestaurantOnlineRate('r1'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ rate: null, expectedUpdatedAt: 'ts', totpCode: '123456' });
    });
    expect(setRestaurantOnline).toHaveBeenCalledWith({ restaurantId: 'r1', rate: null, expectedUpdatedAt: 'ts' });
  });
});
