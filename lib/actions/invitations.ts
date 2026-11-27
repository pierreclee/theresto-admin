'use server';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient, requireAdmin } from '@/lib/supabase/server';
import { ADMIN_LOG_FAILED_MESSAGE } from '@/lib/audit/messages';
import {
  normalizeTwentyQuery,
  parsePrefillResult,
  parseTwentyCompanies,
  twentyErrorMessage,
  TWENTY_INVALID_QUERY_MESSAGE,
  type InvitationPrefillRequest,
  type InvitationPrefillResult,
  type TwentyCompany,
} from '@/lib/utils/twentyPrefill';

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
      /**
       * Préremplissage depuis la fiche Twenty (SIREN, photo) ; null sans fiche, ou si la
       * fonction du serveur ne le connaît pas encore.
       */
      prefill: InvitationPrefillResult | null;
    }
  | { ok: false; code?: string; error: string };

export type SearchTwentyCompaniesResult =
  | { ok: true; companies: TwentyCompany[] }
  | { ok: false; code?: string; error: string };

/**
 * Code et message d'un refus de l'Edge Function : `{ error: { code, message } }`
 * (errorResponse de l'app), ou `{ code, error }` à plat.
 */
async function edgeError(error: Error): Promise<{ code?: string; message: string }> {
  let message = error.message;
  let code: string | undefined;
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    const inner = body?.error;
    if (inner && typeof inner === 'object') {
      message = typeof inner.message === 'string' ? inner.message : message;
      code = typeof inner.code === 'string' ? inner.code : undefined;
    } else {
      message = typeof inner === 'string' ? inner : message;
      code = typeof body?.code === 'string' ? body.code : undefined;
    }
  }
  if (code === 'audit-log-failed') message = ADMIN_LOG_FAILED_MESSAGE;
  else message = twentyErrorMessage(code) ?? message;
  return { code, message };
}

// Errors are returned, not thrown: Next.js hides thrown server action messages
// in production, and these ones are meant for the admin.
export async function inviteRestaurantOwnerAction(
  email: string,
  mode: InvitationMode = 'email',
  prefill?: InvitationPrefillRequest,
): Promise<InviteRestaurantOwnerResult> {
  await requireAdmin();

  const body: Record<string, unknown> = {
    action: 'createRestaurantInvitation',
    email,
    mode: mode === 'accompanied' ? 'accompanied' : 'email',
  };
  // Sans fiche : corps inchangé (ni twentyCompanyId ni photoConsent). L'URL de la photo vue
  // par l'admin part seulement avec l'accord ; sans elle, pas d'accord (rien à comparer).
  if (prefill?.twentyCompanyId) {
    const photoUrl = typeof prefill.photoUrl === 'string' && prefill.photoUrl !== '' ? prefill.photoUrl : null;
    const photoConsent = prefill.photoConsent === true && photoUrl !== null;
    body.twentyCompanyId = prefill.twentyCompanyId;
    body.photoConsent = photoConsent;
    if (photoConsent) body.photoUrl = photoUrl;
  }

  // User-session client: the admin's JWT is forwarded to the Edge Function,
  // which checks the admin claim itself.
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('admin-onboarding', { body });

  if (error) {
    const { code, message } = await edgeError(error);
    return { ok: false, code, error: message };
  }

  const result = data?.data ?? {};
  return { ok: true, ...result, prefill: parsePrefillResult(result.prefill) };
}

/**
 * Recherche des fiches Twenty par nom (2 à 80 caractères), pour préremplir l'invitation.
 * Journalisée par l'Edge Function (search_twenty_companies, nombre de résultats seulement).
 */
export async function searchTwentyCompaniesAction(query: string): Promise<SearchTwentyCompaniesResult> {
  await requireAdmin();

  const q = normalizeTwentyQuery(query);
  if (!q) return { ok: false, code: 'invalid-query', error: TWENTY_INVALID_QUERY_MESSAGE };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('admin-onboarding', {
    body: { action: 'searchTwentyCompanies', query: q },
  });

  if (error) {
    const { code, message } = await edgeError(error);
    return { ok: false, code, error: message };
  }

  return { ok: true, companies: parseTwentyCompanies(data?.data) };
}
