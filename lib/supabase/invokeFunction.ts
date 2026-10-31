import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_LOG_FAILED_MESSAGE, EDGE_AUDIT_LOG_UNAVAILABLE } from '@/lib/audit/messages';

// Appel d'une Edge Function avec la session de l'admin (côté serveur).
// Errors are returned, not thrown: production hides thrown messages.

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code?: string; error: string };

export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<ActionResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    let code: string | undefined;
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      message = payload?.error?.message ?? message;
      code = payload?.error?.code;
    }
    // Consultation refusée par l'Edge Function faute de journal (RGPD-29, D2) : même refus
    // que les lectures de l'admin, affiché par les écrans. Code stable (503) en priorité ;
    // la comparaison du message reconnaît les fonctions déployées avant la PR #60 (500
    // « internal ») et pourra être retirée une fois la PR #60 déployée.
    if (code === 'audit-log-failed' || message === EDGE_AUDIT_LOG_UNAVAILABLE) {
      return { ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE };
    }
    return { ok: false, code, error: message };
  }
  return { ok: true, data: data?.data as T };
}
