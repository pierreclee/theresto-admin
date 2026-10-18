// __tests__/unit/useBackfillPlatformRevenue.test.tsx
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBackfillPlatformRevenue } from '@/lib/hooks/useBilling';
import { backfillPlatformRevenueAction } from '@/lib/actions/billing';

jest.mock('@/lib/actions/billing', () => ({
  backfillPlatformRevenueAction: jest.fn(),
  getRevenueSummaryAction: jest.fn(),
  getStripeOverviewAction: jest.fn(),
}));

const mockAction = backfillPlatformRevenueAction as jest.Mock;

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useBackfillPlatformRevenue(), { wrapper });
  return async () => {
    const outcome: { value?: unknown; error?: Error } = {};
    await act(async () => {
      try {
        outcome.value = await result.current.mutateAsync();
      } catch (e) {
        outcome.error = e as Error;
      }
    });
    return outcome;
  };
}

const GENERIC = 'Reprise impossible. Réessayez ou consultez les logs de migration-tools.';

describe('useBackfillPlatformRevenue', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('renvoie les compteurs en cas de succès', async () => {
    const counts = { subscription: { recorded: 1, unresolved: 0 } };
    mockAction.mockResolvedValue({ ok: true, data: { success: true, counts } });
    expect((await setup()()).value).toEqual(counts);
  });

  it.each([
    ['unauthenticated', 'Session expirée. Reconnectez-vous puis recommencez.'],
    ['permission-denied', 'Droits insuffisants.'],
    ['internal', GENERIC],
  ])('code %s : message français', async (code, message) => {
    mockAction.mockResolvedValue({ ok: false, code, error: 'Raw English error' });
    expect((await setup()()).error?.message).toBe(message);
  });

  it('exception de l\'action : message générique et journalisation', async () => {
    const raw = new Error('fetch failed');
    mockAction.mockRejectedValue(raw);
    expect((await setup()()).error?.message).toBe(GENERIC);
        expect(errorSpy).toHaveBeenCalledWith('[billing] reprise impossible', raw);
  });

  it('journalise l\'erreur brute renvoyée par l\'Edge Function', async () => {
    mockAction.mockResolvedValue({ ok: false, code: 'internal', error: 'Raw English error' });
    expect((await setup()()).error).toBeDefined();
    expect(errorSpy).toHaveBeenCalledWith('[billing] reprise impossible', expect.anything());
  });
});
