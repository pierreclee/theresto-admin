// Libellés et règles d'affichage des alertes des restaurants (sans dépendance serveur).
import type { AlertSeverity, PendingLapseWeek, RestaurantAlert } from '@/lib/types/restaurantAlerts';

export const ALERT_KIND_LABELS: Record<string, string> = {
  restaurant_suspended: 'Restaurant suspendu',
  commission_billing_suspended: 'Commissions impayées : réservations en ligne coupées',
  privatization_incident_open: 'Incident de paiement de privatisation',
  commission_invoice_failed: 'Facture de commissions en échec',
  pending_lapse: 'Demandes non confirmées à la fin du service',
  essentiel_without_payment_method: 'Essentiel sans moyen de paiement',
  closure_pending: 'Clôture en cours',
};

/** Libellé d'un type ; un type inconnu (types futurs, chantier C) ne fait jamais planter l'écran. */
export function alertKindLabel(kind: string): string {
  return ALERT_KIND_LABELS[kind] ?? 'Autre alerte';
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity as AlertSeverity] ?? 3;
}

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Critique',
  warning: 'Attention',
  info: 'Information',
};

/** Classes de la pastille d'un type selon sa gravité (gravité inconnue : gris). */
export function severityClasses(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'warning':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'info':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export interface RestaurantAlertGroup {
  restaurantId: string;
  restaurantName: string | null;
  alerts: RestaurantAlert[];
}

/** Regroupe par restaurant en gardant l'ordre de la base (gravité, puis ancienneté). */
export function groupAlertsByRestaurant(alerts: RestaurantAlert[]): RestaurantAlertGroup[] {
  const groups = new Map<string, RestaurantAlertGroup>();
  for (const alert of alerts) {
    let group = groups.get(alert.restaurantId);
    if (!group) {
      group = { restaurantId: alert.restaurantId, restaurantName: alert.restaurantName, alerts: [] };
      groups.set(alert.restaurantId, group);
    }
    group.alerts.push(alert);
  }
  return [...groups.values()];
}

/** « 12,5 % » depuis une fraction (0.125) ; « — » si null. */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(rate * 100)} %`;
}

/** Fraction (4 décimales au plus) → pourcentage affiché dans le champ (0.1 → 10). */
export function rateToPercent(rate: number): number {
  return Math.round(rate * 10000) / 100;
}

const PERCENT_PATTERN = /^\d+([.,]\d{1,2})?$/;

/** Pourcentage saisi (« 10 » ou « 7,5 ») entre 0 et 100, 2 décimales au plus ; null si invalide. */
export function parseRatePercent(raw: string): number | null {
  const trimmed = raw.trim();
  if (!PERCENT_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

/** Nombre de demandes saisi (entier de 1 à 1000) ; null si invalide. */
export function parseMinCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= 1000 ? value : null;
}

/**
 * Pourcentage (2 décimales au plus) → fraction à 4 décimales pour la base (10 → 0.1), ou
 * null si la valeur n'est pas un pourcentage valide. Calcul en centièmes de point entiers :
 * pas d'erreur d'arrondi binaire (7.3 → 0.073, jamais 0.07299999).
 */
export function percentToRate(percent: unknown): number | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  const hundredths = Math.round(percent * 100);
  if (Math.abs(hundredths - percent * 100) > 1e-6) return null;
  return hundredths / 10000;
}

export const SOURCE_LABELS: Record<string, string> = { app: 'App', widget: 'Widget', staff: 'Équipe' };

export const RESERVATION_TYPE_LABELS: Record<string, string> = {
  tableReservation: 'Table',
  takeaway: 'Click & Collect',
  preOrderNormal: 'Précommande',
  preOrderTimedService: 'Précommande (service minuté)',
};

/** « 11 juin 2031 » depuis une date « AAAA-MM-JJ » (sans décalage horaire). */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** Date et heure de Paris d'un instant ISO ; « — » si absent. */
export function formatInstant(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Europe/Paris',
  });
}

/** Message d'un conflit de version des seuils (PT409). */
export const ALERT_SETTINGS_CONFLICT_MESSAGE =
  'Les seuils ont été modifiés entre-temps : rechargez la page et vérifiez les nouvelles valeurs.';

/** Fermetures listées par page sur la fiche (la RPC accepte 1 à 200). */
export const CLOSURES_PAGE_SIZE = 20;

/** Détail court d'une alerte, d'après ses chiffres connus ; null pour un type sans détail. */
export function alertDetail(alert: { kind: string; metrics: Record<string, unknown> }): string | null {
  const m = alert.metrics ?? {};
  const n = (key: string) => (typeof m[key] === 'number' ? (m[key] as number) : Number.NaN);
  const euro = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  switch (alert.kind) {
    case 'pending_lapse':
      return Number.isFinite(n('lapsed_30d')) && Number.isFinite(n('total_30d'))
        ? `${n('lapsed_30d')} sur ${n('total_30d')} demandes en 30 jours (${formatRate(n('rate_30d'))})`
        : null;
    case 'commission_billing_suspended':
    case 'commission_invoice_failed':
      return Number.isFinite(n('unpaid_invoices'))
        ? `${n('unpaid_invoices')} facture(s) impayée(s)${Number.isFinite(n('unpaid_amount_ht')) ? `, ${euro(n('unpaid_amount_ht'))} HT` : ''}`
        : null;
    case 'privatization_incident_open':
      return Number.isFinite(n('open_incidents')) ? `${n('open_incidents')} incident(s) ouvert(s)` : null;
    case 'closure_pending':
      return typeof m.anonymization_from === 'string'
        ? `Anonymisation à partir du ${formatInstant(m.anonymization_from as string, false)}`
        : null;
    default:
      return null;
  }
}

/** Échelle du taux (axe de droite) : de 10 % en 10 %, au moins jusqu'au seuil, 100 % au plus. */
export function rateAxisMax(weeks: PendingLapseWeek[], minRate?: number | null): number {
  const rates = weeks.filter((w) => w.tracked && w.rate !== null).map((w) => w.rate as number);
  const top = Math.max(0.1, minRate ?? 0, ...rates);
  return Math.min(1, Math.ceil(top * 10 - 1e-9) / 10);
}
