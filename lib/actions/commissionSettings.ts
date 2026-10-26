'use server';

import { requireAdmin } from '@/lib/supabase/server';
import { invokeEdgeFunction, type ActionResult } from '@/lib/supabase/invokeFunction';
import type {
  CommissionMonthlyTotal,
  CommissionSettings,
  PlanCommissionRates,
  RestaurantCommission,
} from '@/lib/types/commissions';

// Tarifs des commissions de réservation (plan Essentiel), taux des paiements en ligne et des privatisations, via l'Edge Function
// commission-settings. Toute modification exige côté serveur un code TOTP
// vérifié il y a moins de 5 min. `expectedUpdatedAt` (contrôle de concurrence
// optimiste) est toujours envoyé explicitement : le serveur refuse une clé
// absente, et n'accepte null que pour un restaurant sans tarif propre.

/** Résultat d'une modification ; auditLogged=false si la journalisation a échoué (le tarif est modifié). */
export interface CommissionUpdateResult {
  updatedAt: string;
  auditLogged: boolean;
}

const FUNCTION_NAME = 'commission-settings';

export async function getCommissionSettingsAction(): Promise<
  ActionResult<{
    settings: CommissionSettings;
    onlineRates: PlanCommissionRates;
    privatizationRates: PlanCommissionRates;
    totals: CommissionMonthlyTotal[];
  }>
> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, { action: 'getCommissionSettings' });
}

export async function updateGlobalCommissionRatesAction(input: {
  tableFeeHt: number;
  guestFeeHt: number;
  minInvoiceHt: number;
  maxCarryMonths: number;
  expectedUpdatedAt: string;
}): Promise<ActionResult<CommissionUpdateResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'updateGlobalCommissionRates',
    tableFeeHt: input.tableFeeHt,
    guestFeeHt: input.guestFeeHt,
    minInvoiceHt: input.minInvoiceHt,
    maxCarryMonths: input.maxCarryMonths,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}

export async function getRestaurantCommissionAction(
  restaurantId: string,
): Promise<ActionResult<{ commission: RestaurantCommission }>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, { action: 'getRestaurantCommission', restaurantId });
}

export async function updateRestaurantCommissionRatesAction(input: {
  restaurantId: string;
  tableFeeHt: number;
  guestFeeHt: number;
  expectedUpdatedAt: string | null;
}): Promise<ActionResult<CommissionUpdateResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'updateRestaurantCommissionRates',
    restaurantId: input.restaurantId,
    tableFeeHt: input.tableFeeHt,
    guestFeeHt: input.guestFeeHt,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
  });
}

export async function resetRestaurantCommissionRatesAction(input: {
  restaurantId: string;
  expectedUpdatedAt: string | null;
}): Promise<ActionResult<CommissionUpdateResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'resetRestaurantCommissionRates',
    restaurantId: input.restaurantId,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
  });
}

export async function updateGlobalOnlineRatesAction(input: {
  croissanceRate: number;
  liberteRate: number;
  expectedUpdatedAt: string;
}): Promise<ActionResult<CommissionUpdateResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'updateGlobalOnlineRates',
    croissanceRate: input.croissanceRate,
    liberteRate: input.liberteRate,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}

/** rate null : le restaurant suit de nouveau le taux de son plan. */
export async function setRestaurantOnlineRateAction(input: {
  restaurantId: string;
  rate: number | null;
  expectedUpdatedAt: string | null;
}): Promise<ActionResult<CommissionUpdateResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'setRestaurantOnlineRate',
    restaurantId: input.restaurantId,
    rate: input.rate,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
  });
}

export async function updateGlobalPrivatizationRatesAction(input: {
  croissanceRate: number;
  liberteRate: number;
  expectedUpdatedAt: string;
}): Promise<ActionResult<CommissionUpdateResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'updateGlobalPrivatizationRates',
    croissanceRate: input.croissanceRate,
    liberteRate: input.liberteRate,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}

/** rate null : le restaurant suit de nouveau le taux de privatisation de son plan. */
export async function setRestaurantPrivatizationRateAction(input: {
  restaurantId: string;
  rate: number | null;
  expectedUpdatedAt: string | null;
}): Promise<ActionResult<CommissionUpdateResult>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'setRestaurantPrivatizationRate',
    restaurantId: input.restaurantId,
    rate: input.rate,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
  });
}
