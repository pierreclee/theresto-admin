'use server';

import { requireAdmin } from '@/lib/supabase/server';
import { invokeEdgeFunction, type ActionResult } from '@/lib/supabase/invokeFunction';
import type { AppVersionPolicy, AppVersionPolicyInput } from '@/lib/types/appVersion';

// Version minimale et recommandée de l'app mobile (P10), via l'Edge Function
// app-version-settings (session de l'admin). Toute modification exige côté serveur un code
// TOTP vérifié il y a moins de 5 min, et la fonction refuse (503 audit-log-failed) si son
// journal d'administration ne s'écrit pas. `expectedUpdatedAt` : contrôle de concurrence (409).

const FUNCTION_NAME = 'app-version-settings';

export async function getAppVersionPoliciesAction(): Promise<ActionResult<{ policies: AppVersionPolicy[] }>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, { action: 'getAppVersionPolicies' });
}

export async function updateAppVersionPolicyAction(
  input: AppVersionPolicyInput,
): Promise<ActionResult<{ policy: AppVersionPolicy; auditLogged: boolean }>> {
  await requireAdmin();
  // Saisie complète, champ par champ : rien d'autre n'est transmis à la fonction.
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'updateAppVersionPolicy',
    platform: input.platform,
    minVersion: input.minVersion,
    minBuild: input.minBuild,
    recommendedVersion: input.recommendedVersion,
    recommendedBuild: input.recommendedBuild,
    message: input.message ?? null,
    storeUrl: input.storeUrl ?? null,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}
