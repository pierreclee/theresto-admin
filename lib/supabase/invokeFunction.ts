import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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
    return { ok: false, code, error: message };
  }
  return { ok: true, data: data?.data as T };
}
