import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCommissionSettings, useRestaurantCommission } from '@/lib/hooks/useCommissionSettings';
import { getCommissionSettingsAction, getRestaurantCommissionAction } from '@/lib/actions/commissionSettings';

jest.mock('@/lib/actions/commissionSettings', () => ({
  getCommissionSettingsAction: jest.fn(),
  getRestaurantCommissionAction: jest.fn(),
  resetRestaurantCommissionRatesAction: jest.fn(),
  updateGlobalCommissionRatesAction: jest.fn(),
  updateRestaurantCommissionRatesAction: jest.fn(),
}));
jest.mock('@/lib/auth/verifyTotp', () => ({ verifyTotpCode: jest.fn() }));
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => jest.fn() }));

const getSettings = getCommissionSettingsAction as jest.Mock;
const getRestaurant = getRestaurantCommissionAction as jest.Mock;

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
