import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActionError, shouldRetryQuery } from '@/lib/api/actionResult';
import { listPrivatizationIncidentsAction } from '@/lib/actions/privatizationIncidents';
import { usePrivatizationIncidents } from '@/lib/hooks/usePrivatizationIncidents';

// D4 (recette PR #8) : le badge des incidents interrogeait le serveur sur la page de connexion
// et relançait en boucle quand la session admin avait expiré (500 de requireAdmin).

jest.mock('@/lib/actions/privatizationIncidents', () => ({
  listPrivatizationIncidentsAction: jest.fn(),
  resolvePrivatizationIncidentAction: jest.fn(),
  retryPrivatizationRefundAction: jest.fn(),
  returnPrivatizationCustomerBalanceAction: jest.fn(),
}));
jest.mock('@/lib/auth/verifyTotp', () => ({ verifyTotpCode: jest.fn() }));
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => jest.fn() }));

const listMock = listPrivatizationIncidentsAction as jest.Mock;

// Politique de relance réelle de l'application, sans délai entre deux essais.
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('liste des incidents et session', () => {
  it('enabled: false : aucune requête', async () => {
    const { result } = renderHook(() => usePrivatizationIncidents('open', { enabled: false }), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(listMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('action serveur en échec (requireAdmin) : refus d authentification, un seul appel', async () => {
    listMock.mockRejectedValue(new Error('An error occurred in the Server Components render'));
    const { result } = renderHook(() => usePrivatizationIncidents('open'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBeInstanceOf(ActionError);
    expect((result.current.error as ActionError).code).toBe('unauthenticated');
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('refus unauthenticated de l Edge Function : pas de relance', async () => {
    listMock.mockResolvedValue({ ok: false, code: 'unauthenticated', error: 'x' });
    const { result } = renderHook(() => usePrivatizationIncidents('open'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Session expirée. Reconnectez-vous puis rechargez la page.');
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('autre erreur : relancée comme avant (3 essais de plus)', async () => {
    listMock.mockResolvedValue({ ok: false, code: 'internal', error: 'x' });
    const { result } = renderHook(() => usePrivatizationIncidents('open'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 3000 });
    expect(result.current.error?.message).toBe('Impossible de charger les incidents.');
    expect(listMock).toHaveBeenCalledTimes(4);
  });
});
