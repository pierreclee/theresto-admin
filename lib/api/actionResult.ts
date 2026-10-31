// Résultats typés des Server Actions, déballés côté navigateur. Une Server Action renvoie
// { ok: false, error } plutôt que de lever : Next.js masque en production le message d'une
// exception levée côté serveur. L'erreur est levée ici, dans le navigateur, où le message
// reste lisible (ex. refus faute de journal d'administration, RGPD-29 D2).

import { ADMIN_LOG_FAILED_MESSAGE } from '@/lib/audit/messages';

export type ActionOutcome<T> = { ok: true; data: T } | { ok: false; code?: string; error: string };

export class ActionError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export async function unwrapAction<T>(result: Promise<ActionOutcome<T>>): Promise<T> {
  const r = await result;
  if (!r.ok) throw new ActionError(r.error, r.code);
  return r.data;
}

/** Message d'une ActionError (voulu pour l'écran) ; texte de repli pour toute autre erreur. */
export function actionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ActionError ? error.message : fallback;
}

/** Refus faute de journal d'administration : inutile de relancer la requête, le refus reviendrait. */
export function isAuditLogRefusal(error: unknown): boolean {
  if (error instanceof ActionError && error.code === 'audit-log-failed') return true;
  return error instanceof Error && error.message === ADMIN_LOG_FAILED_MESSAGE;
}

/** Politique de relance de React Query : 3 essais comme par défaut, aucun sur un refus de journal. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return !isAuditLogRefusal(error) && failureCount < 3;
}
