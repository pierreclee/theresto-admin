'use server';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient, requireAdmin } from '@/lib/supabase/server';
import type { PaidPlan, SubscriptionPriceInfo } from '@/lib/types/config';

// Prix des abonnements : Stripe est la source de vérité, lu et modifié via
// l'Edge Function subscription-prices avec la session de l'admin. La
// modification exige côté serveur un code TOTP vérifié il y a moins de 5 min.
// Errors are returned, not thrown: production hides thrown messages.

type ActionResult<T> = { ok: true; data: T } | { ok: false; code?: string; error: string };

async function invokeSubscriptionPrices<T>(body: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('subscription-prices', { body });
  if (error) {
    let message = error.message;
    let code: string | undefined;
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      message = payload?.error?.message ?? message;
      code = payload?.error?.code;
    }
    return { ok: false, code, error: message };
  }
  return { ok: true, data: data?.data as T };
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
