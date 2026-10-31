import type { AuditLog } from '@/lib/types/audit';

// Ligne de platform_logs (schéma du lot 9 : event_type, actor_id et ip_address supprimées).
export interface PlatformLogRow {
  id: string;
  action: string;
  performed_by: string | null;
  performed_by_email: string | null;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const PLATFORM_LOG_COLUMNS =
  'id, action, performed_by, performed_by_email, target_type, target_id, details, created_at';

/** Ligne de platform_logs → AuditLog de l'écran Monitoring. Une action *_failed est un échec. */
export function toAuditLog(row: PlatformLogRow): AuditLog {
  return {
    id: row.id,
    adminId: row.performed_by ?? '',
    adminEmail: row.performed_by_email ?? undefined,
    action: row.action,
    resourceType: row.target_type ?? '',
    resourceId: row.target_id ?? undefined,
    changes: row.details ?? undefined,
    timestamp: new Date(row.created_at),
    success: !row.action.endsWith('_failed'),
  };
}

const PARIS_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Écart (ms) entre l'heure de Paris et UTC à l'instant donné. */
function parisOffsetMs(instant: number): number {
  const p = Object.fromEntries(PARIS_PARTS.formatToParts(new Date(instant)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
}

/**
 * Minuit à Paris du jour `day` (« AAAA-MM-JJ », valeur d'un <input type="date">), décalé de
 * `addDays` jours. Les filtres « du / au » de l'écran Monitoring sont des jours de Paris.
 * null si la date est invalide.
 */
export function parisDayStart(day: string, addDays = 0): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const wall = Date.UTC(y, mo - 1, d + addDays);
  // Deux passes : l'écart peut changer entre minuit UTC et minuit à Paris (changement d'heure).
  const first = wall - parisOffsetMs(wall);
  return new Date(wall - parisOffsetMs(first));
}

// Actions écrites dans platform_logs (RGPD-29) : Server Actions de theresto-admin et Edge
// Functions admin de theresto_app (admin-onboarding, admin-restaurant-billing,
// admin-privatization-incidents, commission-settings, subscription-prices, migration-tools,
// cron-invoice-commissions).
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  list_users: 'Liste des utilisateurs consultée',
  view_user: 'Utilisateur consulté',
  view_user_profile: 'Fiche utilisateur consultée',
  moderate_user: 'Utilisateur modéré',
  list_restaurants: 'Liste des restaurants consultée',
  view_restaurant: 'Restaurant consulté',
  view_kbis: 'Kbis consulté',
  view_restaurant_billing: 'Facturation du restaurant consultée',
  update_restaurant: 'Restaurant modifié',
  suspend_restaurant: 'Restaurant suspendu',
  approve_restaurant: 'Restaurant approuvé',
  reject_restaurant: 'Restaurant refusé',
  create_restaurant_invitation: 'Invitation envoyée',
  subscription_plan_changed: 'Formule modifiée',
  update_platform_config: 'Configuration modifiée',
  update_subscription_price: 'Prix d’abonnement modifié',
  update_global_commission_rates: 'Commissions globales modifiées',
  update_restaurant_commission_rates: 'Commissions du restaurant modifiées',
  reset_restaurant_commission_rates: 'Commissions du restaurant réinitialisées',
  update_global_online_commission_rates: 'Taux en ligne globaux modifiés',
  update_restaurant_online_commission_rate: 'Taux en ligne du restaurant modifié',
  reset_restaurant_online_commission_rate: 'Taux en ligne du restaurant réinitialisé',
  update_global_privatization_commission_rates: 'Taux de privatisation globaux modifiés',
  update_restaurant_privatization_commission_rate: 'Taux de privatisation du restaurant modifié',
  reset_restaurant_privatization_commission_rate: 'Taux de privatisation du restaurant réinitialisé',
  list_privatization_incidents: 'Incidents de privatisation consultés',
  retry_privatization_refund: 'Remboursement relancé',
  retry_privatization_refund_failed: 'Remboursement relancé (échec)',
  return_privatization_customer_balance: 'Solde client rendu',
  return_privatization_customer_balance_failed: 'Solde client rendu (échec)',
  resolve_privatization_incident: 'Incident traité',
  backfill_platform_revenue: 'Revenus de la plateforme recalculés',
  commission_invoice_failed: 'Facture de commissions en échec',
};

export const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  user: 'Utilisateur',
  restaurant: 'Restaurant',
  kbis: 'Kbis',
  config: 'Configuration',
  onboarding_invitation: 'Invitation',
  commission_rates: 'Commissions',
  subscription_price: 'Prix',
  privatization_incident: 'Incident',
  commission_invoice: 'Facture',
  platform: 'Plateforme',
};

function toOptions(labels: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(labels)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/** Choix des filtres « Action » et « Type » du Monitoring. */
export const AUDIT_ACTION_OPTIONS = toOptions(AUDIT_ACTION_LABELS);
export const AUDIT_RESOURCE_OPTIONS = toOptions(AUDIT_RESOURCE_LABELS);

// Détails affichés : liste blanche de clés, par type. Jamais de texte libre (D3) : une chaîne
// n'est montrée que pour une clé de code (statut, plan…) et si elle a la forme d'un code ;
// erreurs, e-mails, motifs, identifiants Stripe et clés inconnues ne sont jamais affichés.
const CODE = /^[A-Za-z0-9_-]{1,40}$/;
const BOOLEAN_KEYS: Record<string, string> = {
  hasAccount: 'Compte existant',
  hasStripeCustomer: 'Client Stripe',
  hasReason: 'Motif saisi',
  hasNote: 'Note saisie',
  search: 'Recherche',
  maintenanceMode: 'Maintenance',
};
const NUMBER_KEYS: Record<string, string> = {
  count: 'Lignes',
  sectionsToFix: 'Sections à corriger',
  attempts: 'Tentatives',
};
const EURO_KEYS: Record<string, string> = {
  previousAmount: 'Ancien montant',
  newAmount: 'Nouveau montant',
};
const CODE_KEYS: Record<string, string> = {
  status: 'Statut',
  newStatus: 'Nouveau statut',
  correctionMode: 'Mode',
  oldPlan: 'Ancien plan',
  newPlan: 'Nouveau plan',
  roleFilter: 'Rôle',
  statusFilter: 'Filtre de statut',
  subscription: 'Abonnement',
  refundStatus: 'Statut du remboursement',
  currency: 'Devise',
  period: 'Période',
};
const EURO = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

function formatDetail(key: string, value: unknown): string | null {
  if (key in BOOLEAN_KEYS) return typeof value === 'boolean' ? `${BOOLEAN_KEYS[key]} : ${value ? 'oui' : 'non'}` : null;
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  if (key in NUMBER_KEYS) return isNumber ? `${NUMBER_KEYS[key]} : ${value}` : null;
  if (key === 'amountCents') return isNumber ? `Montant : ${EURO.format((value as number) / 100)}` : null;
  if (key in EURO_KEYS) return isNumber ? `${EURO_KEYS[key]} : ${EURO.format(value as number)}` : null;
  if (key in CODE_KEYS) return typeof value === 'string' && CODE.test(value) ? `${CODE_KEYS[key]} : ${value}` : null;
  if (key === 'fields' && Array.isArray(value)) {
    const fields = value.filter((f): f is string => typeof f === 'string' && CODE.test(f));
    return fields.length ? `Champs : ${fields.join(', ')}` : null;
  }
  return null;
}

/** Détails d'une ligne du journal, lisibles et sans texte libre ; '' si rien à montrer. */
export function formatAuditDetails(details: Record<string, unknown> | null | undefined): string {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .map(([key, value]) => formatDetail(key, value))
    .filter((part): part is string => part !== null)
    .join(' · ');
}
