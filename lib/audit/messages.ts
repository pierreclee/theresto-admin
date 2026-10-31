// Messages du journal d'administration (RGPD-29, lot 9), sans dépendance serveur.

/** Refus d'une consultation faute de journal (D2), affiché tel quel à l'admin. */
export const ADMIN_LOG_FAILED_MESSAGE =
  "Consultation impossible : le journal d'administration n'a pas pu être écrit. Réessayez.";

/**
 * Message d'une Edge Function de theresto_app qui refuse une consultation faute de journal
 * (AUDIT_LOG_UNAVAILABLE de supabase/functions/_shared/platform-log.ts, renvoyé en 500
 * « internal » par admin-restaurant-billing et admin-privatization-incidents avant la PR #60,
 * qui les fait répondre 503 avec le code « audit-log-failed »). Repli à retirer après son
 * déploiement.
 */
export const EDGE_AUDIT_LOG_UNAVAILABLE =
  "Consultation impossible : le journal d'administration n'a pas pu être écrit.";
