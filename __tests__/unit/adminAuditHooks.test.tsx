// RGPD-29 (lot 9, D2) côté écran : écriture faite mais non journalisée → toast d'erreur ;
// consultation refusée faute de journal → message lisible (un résultat, pas une exception
// serveur, que Next.js masquerait en production).
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  approveRestaurantAction,
  getRestaurantDetailAction,
  updateConfigAction,
  updateRestaurantAction,
} from '@/lib/actions/admin';
import { getCrmProfileAction } from '@/lib/actions/users';
import { useApproveRestaurant, useRestaurantDetail, useUpdateRestaurant } from '@/lib/hooks/useRestaurants';
import { useUpdatePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import { useUserCrmProfile } from '@/lib/hooks/useUsers';
import { ActionError, actionErrorMessage } from '@/lib/api/actionResult';
import { getStripeOverviewAction } from '@/lib/actions/billing';
import { listPrivatizationIncidentsAction } from '@/lib/actions/privatizationIncidents';
import { useStripeOverview } from '@/lib/hooks/useBilling';
import { usePrivatizationIncidents } from '@/lib/hooks/usePrivatizationIncidents';

jest.mock('@/lib/actions/admin', () => ({
  approveRestaurantAction: jest.fn(),
  getRestaurantDetailAction: jest.fn(),
  updateConfigAction: jest.fn(),
  updateRestaurantAction: jest.fn(),
}));
jest.mock('@/lib/actions/users', () => ({ getCrmProfileAction: jest.fn() }));
jest.mock('@/lib/actions/billing', () => ({
  getStripeOverviewAction: jest.fn(),
  getRevenueSummaryAction: jest.fn(),
  backfillPlatformRevenueAction: jest.fn(),
}));
jest.mock('@/lib/actions/privatizationIncidents', () => ({
  listPrivatizationIncidentsAction: jest.fn(),
  resolvePrivatizationIncidentAction: jest.fn(),
  retryPrivatizationRefundAction: jest.fn(),
  returnPrivatizationCustomerBalanceAction: jest.fn(),
}));
jest.mock('@/lib/auth/verifyTotp', () => ({ verifyTotpCode: jest.fn() }));
const toast = jest.fn();
jest.mock('@/components/shared/Toaster', () => ({ useToast: () => toast }));

const REFUSED = {
  ok: false,
  code: 'audit-log-failed',
  error: "Consultation impossible : le journal d'administration n'a pas pu être écrit. Réessayez.",
};
const NOT_LOGGED = expect.stringMatching(/n'a pas pu être journalisée\. Prévenez l'équipe technique\./);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

describe('écritures : auditLogged=false signalé', () => {
  it('modification d un restaurant', async () => {
    (updateRestaurantAction as jest.Mock).mockResolvedValue({ restaurant: { id: 'r1' }, auditLogged: false });
    const { result } = renderHook(() => useUpdateRestaurant(), { wrapper });
    await act(() => result.current.mutateAsync({ restaurantId: 'r1', updates: { name: 'X' } as never }));
    expect(toast).toHaveBeenCalledWith(NOT_LOGGED, 'error');
  });

  it('modification d un restaurant journalisée : toast normal', async () => {
    (updateRestaurantAction as jest.Mock).mockResolvedValue({ restaurant: { id: 'r1' }, auditLogged: true });
    const { result } = renderHook(() => useUpdateRestaurant(), { wrapper });
    await act(() => result.current.mutateAsync({ restaurantId: 'r1', updates: { name: 'X' } as never }));
    expect(toast).toHaveBeenCalledWith('Restaurant mis à jour');
  });

  it('suspension d un restaurant', async () => {
    (approveRestaurantAction as jest.Mock).mockResolvedValue({ ok: true, auditLogged: false });
    const { result } = renderHook(() => useApproveRestaurant(), { wrapper });
    await act(() => result.current.mutateAsync({ restaurantId: 'r1', status: 'suspended' }));
    expect(toast).toHaveBeenCalledWith(NOT_LOGGED, 'error');
  });

  it('approbation non journalisée par l Edge Function admin-onboarding', async () => {
    (approveRestaurantAction as jest.Mock).mockResolvedValue({ ok: true, auditLogged: false });
    const { result } = renderHook(() => useApproveRestaurant(), { wrapper });
    await act(() => result.current.mutateAsync({ restaurantId: 'r1', status: 'approved' }));
    expect(toast).toHaveBeenCalledWith(NOT_LOGGED, 'error');
  });

  it('approbation journalisée par l Edge Function : toast normal', async () => {
    (approveRestaurantAction as jest.Mock).mockResolvedValue({ ok: true, auditLogged: true });
    const { result } = renderHook(() => useApproveRestaurant(), { wrapper });
    await act(() => result.current.mutateAsync({ restaurantId: 'r1', status: 'approved' }));
    expect(toast).toHaveBeenCalledWith('Statut du restaurant mis à jour');
  });

  it('configuration', async () => {
    (updateConfigAction as jest.Mock).mockResolvedValue({ config: { currency: 'EUR', maintenanceMode: true }, auditLogged: false });
    const { result } = renderHook(() => useUpdatePlatformConfig(), { wrapper });
    await act(() => result.current.mutateAsync({ maintenanceMode: true }));
    expect(toast).toHaveBeenCalledWith(NOT_LOGGED, 'error');
  });
});

describe('consultations refusées faute de journal : message lisible', () => {
  it('fiche restaurant', async () => {
    (getRestaurantDetailAction as jest.Mock).mockResolvedValue(REFUSED);
    const { result } = renderHook(() => useRestaurantDetail('r1'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(actionErrorMessage(result.current.error, 'x')).toBe(REFUSED.error);
  });

  it('fiche CRM', async () => {
    (getCrmProfileAction as jest.Mock).mockResolvedValue(REFUSED);
    const { result } = renderHook(() => useUserCrmProfile('u1'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(actionErrorMessage(result.current.error, 'x')).toBe(REFUSED.error);
  });

  it('fiche Stripe du restaurant (admin-restaurant-billing)', async () => {
    (getStripeOverviewAction as jest.Mock).mockResolvedValue(REFUSED);
    const { result } = renderHook(() => useStripeOverview('r1'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe(REFUSED.error);
  });

  it('liste des incidents de privatisation', async () => {
    (listPrivatizationIncidentsAction as jest.Mock).mockResolvedValue(REFUSED);
    const { result } = renderHook(() => usePrivatizationIncidents('open'), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe(REFUSED.error);
  });

  it('actionErrorMessage : message de l action, sinon texte de repli (message serveur masqué)', () => {
    expect(actionErrorMessage(new ActionError('Refus', 'audit-log-failed'), 'Repli')).toBe('Refus');
    expect(actionErrorMessage(new Error('An error occurred in the Server Components render'), 'Repli')).toBe('Repli');
    expect(actionErrorMessage(null, 'Repli')).toBe('Repli');
  });
});
