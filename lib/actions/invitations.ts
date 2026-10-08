'use server';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient, requireAdmin } from '@/lib/supabase/server';

export type InviteRestaurantOwnerResult =
  | {
      ok: true;
      email: string;
      onboardingUrl: string;
      expiresAt: string;
      /** False when the staging guard blocked the email (non-whitelisted domain). */
      emailSent: boolean;
    }
  | { ok: false; error: string };

// Errors are returned, not thrown: Next.js hides thrown server action messages
// in production, and these ones are meant for the admin.
export async function inviteRestaurantOwnerAction(
  email: string
): Promise<InviteRestaurantOwnerResult> {
  await requireAdmin();

  // User-session client: the admin's JWT is forwarded to the Edge Function,
  // which checks the admin claim itself.
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('admin-onboarding', {
    body: { action: 'createRestaurantInvitation', email },
  });

  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      message = body?.error?.message ?? message;
    }
    return { ok: false, error: message };
  }

  return { ok: true, ...data.data };
}
