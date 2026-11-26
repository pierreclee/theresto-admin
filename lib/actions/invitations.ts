'use server';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient, requireAdmin } from '@/lib/supabase/server';

/**
 * Parcours de l'invitation : 'email' (7 jours, e-mail envoyé, Kbis obligatoire) ou
 * 'accompanied' (rendez-vous avec le restaurateur : 2 heures, aucun e-mail, lien et QR code
 * affichés ici, Kbis facultatif). Contrat : docs/features/onboarding-accompagne.md de l'app.
 */
export type InvitationMode = 'email' | 'accompanied';

export type InviteRestaurantOwnerResult =
  | {
      ok: true;
      email: string;
      onboardingUrl: string;
      expiresAt: string;
      /** False: no account yet — the link leads to signup with the email pre-filled. */
      hasAccount: boolean;
      /** False when the staging guard blocked the email (non-whitelisted domain), and always in accompanied mode. */
      emailSent: boolean;
      /** Parcours de l'invitation créée (absent d'une ancienne version de l'Edge Function : 'email'). */
      mode?: InvitationMode;
      /**
       * Journal d'administration (RGPD-29) écrit par l'Edge Function admin-onboarding
       * (create_restaurant_invitation) ; false : invitation faite, journal en échec (D2).
       */
      auditLogged?: boolean;
    }
  | { ok: false; error: string };

// Errors are returned, not thrown: Next.js hides thrown server action messages
// in production, and these ones are meant for the admin.
export async function inviteRestaurantOwnerAction(
  email: string,
  mode: InvitationMode = 'email'
): Promise<InviteRestaurantOwnerResult> {
  await requireAdmin();

  // User-session client: the admin's JWT is forwarded to the Edge Function,
  // which checks the admin claim itself.
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('admin-onboarding', {
    body: { action: 'createRestaurantInvitation', email, mode: mode === 'accompanied' ? 'accompanied' : 'email' },
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
