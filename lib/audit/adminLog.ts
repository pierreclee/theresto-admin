// Journal d'administration (RGPD-29, lot 9) : chaque consultation d'une donnée personnelle et
// chaque écriture d'un admin écrit une ligne de platform_logs (inaltérable, purgée à 1 an).
// Identifiants, noms de champs et valeurs non personnelles seulement : jamais un nom, un
// e-mail (hors celui de l'admin), un téléphone ni le texte d'un motif (D3).
// created_at est fixé par la base : ne pas l'envoyer.
import { getAdminClient } from '@/lib/supabase/server';

export type AdminTargetType = 'user' | 'restaurant' | 'kbis' | 'config';

export interface AdminLogEntry {
  action: string;
  targetType: AdminTargetType;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

export interface AdminActor {
  id: string;
  email?: string | null;
}

export const ADMIN_LOG_FAILED_MESSAGE =
  "Consultation impossible : le journal d'administration n'a pas pu être écrit. Réessayez.";

/**
 * Refus d'une consultation faute de journal (D2). Renvoyé, jamais levé : Next.js masque en
 * production le message d'une exception levée par une Server Action.
 */
export interface AdminLogRefusal {
  ok: false;
  code: 'audit-log-failed';
  error: string;
}

export function adminLogRefusal(): AdminLogRefusal {
  return { ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE };
}

/** Écrit la ligne ; false si l'écriture échoue (jamais d'exception). */
export async function logAdminAction(admin: AdminActor, entry: AdminLogEntry): Promise<boolean> {
  try {
    const db = await getAdminClient();
    const { error } = await db.from('platform_logs').insert({
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      performed_by: admin.id,
      performed_by_email: admin.email ?? null,
      details: entry.details ?? {},
    });
    if (error) console.error(`[admin-log] ${entry.action} non journalisé :`, error.code ?? 'erreur');
    return !error;
  } catch (e) {
    console.error(`[admin-log] ${entry.action} non journalisé :`, e instanceof Error ? e.name : 'erreur');
    return false;
  }
}
