'use server';

import { requireAdmin } from '@/lib/supabase/server';
import { invokeEdgeFunction, type ActionResult } from '@/lib/supabase/invokeFunction';
import type { PaidPlan, SubscriptionPriceInfo } from '@/lib/types/config';

// Prix des abonnements : Stripe est la source de vérité, lu et modifié via
// l'Edge Function subscription-prices avec la session de l'admin. La
// modification exige côté serveur un code TOTP vérifié il y a moins de 5 min.
// Errors are returned, not thrown: production hides thrown messages.

function invokeSubscriptionPrices<T>(body: Record<string, unknown>): Promise<ActionResult<T>> {
  return invokeEdgeFunction<T>('subscription-prices', body);
}

export async function getSubscriptionPricesAction(): Promise<ActionResult<SubscriptionPriceInfo[]>> {
  await requireAdmin();
  const result = await invokeSubscriptionPrices<{ prices: SubscriptionPriceInfo[] }>({
    action: 'getSubscriptionPrices',
  });
  return result.ok ? { ok: true, data: result.data?.prices ?? [] } : result;
}

export async function updateSubscriptionPriceAction(
  plan: PaidPlan,
  amount: number,
  expectedPriceId: string,
): Promise<ActionResult<SubscriptionPriceInfo>> {
  await requireAdmin();
  const result = await invokeSubscriptionPrices<{ price: SubscriptionPriceInfo }>({
    action: 'updateSubscriptionPrice',
    plan,
    amount,
    expectedPriceId,
  });
  return result.ok ? { ok: true, data: result.data.price } : result;
}
