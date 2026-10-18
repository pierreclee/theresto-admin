// lib/actions/billing.ts
'use server';

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';
import { invokeEdgeFunction, type ActionResult } from '@/lib/supabase/invokeFunction';
import type { BackfillCounts, RevenueSummary, StripeOverview } from '@/lib/types/billing';

// Facturation TheResto d'un restaurant : état Stripe en direct (Edge Function
// admin-restaurant-billing, lecture seule) et registre des revenus (RPC
// admin_restaurant_revenue_summary, service role).

export async function getStripeOverviewAction(restaurantId: string): Promise<ActionResult<StripeOverview>> {
  await requireAdmin();
  return invokeEdgeFunction('admin-restaurant-billing', { action: 'getStripeOverview', restaurantId });
}

export async function getRevenueSummaryAction(restaurantId: string): Promise<ActionResult<RevenueSummary>> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const { data, error } = await adminDb.rpc('admin_restaurant_revenue_summary', { p_restaurant_id: restaurantId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as RevenueSummary };
}

export async function backfillPlatformRevenueAction(): Promise<ActionResult<{ success: boolean; counts: BackfillCounts }>> {
  await requireAdmin();
  return invokeEdgeFunction('migration-tools', { action: 'backfillPlatformRevenue' });
}
