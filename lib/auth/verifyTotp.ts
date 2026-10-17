'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Vérifie un code TOTP : la session passe en AAL2 avec un facteur récent,
 * que les Edge Functions revérifient (verifyRecentMfa) pour toute
 * modification de tarif.
 */
export async function verifyTotpCode(code: string): Promise<void> {
  const supabase = createClient();
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  const totp = factors?.totp?.find((f) => f.status === 'verified');
  if (!totp) throw new Error("Aucune application d'authentification configurée pour ce compte");

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code });
  if (verifyError) throw new Error('Code de vérification invalide');
}
