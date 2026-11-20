// Libellés et règles d'affichage des alertes des restaurants (sans dépendance serveur).
import type { AlertSeverity, PendingLapseWeek, RestaurantAlert } from '@/lib/types/restaurantAlerts';

// Contrat : docs/features/admin-restaurant-alerts.md §3.3 et §6 (dépôt theresto_app).
export const ALERT_KIND_LABELS: Record<string, string> = {
  restaurant_suspended: 'Restaurant suspendu',
  commission_billing_suspended: 'Commissions impayées',
  privatization_incident_open: 'Incident de paiement de privatisation',
  commission_invoice_failed: 'Facture de commissions en échec',
  subscription_past_due: 'Prélèvement de l’abonnement en échec',
  subscription_unpaid: 'Abonnement impayé : repassé en Essentiel',
  dispute_open: 'Litige ouvert sur un paiement',
  dispute_lost: 'Litige perdu : refacturé',
  dispute_reversed_after_billing: 'Litige renversé après facturation : avoir à faire',
  dispute_other_open: 'Litige hors réservation',
  recharge_recovery_failed: 'Reprise des refacturations en échec',
  pending_lapse: 'Demandes non confirmées à la fin du service',
  essentiel_without_payment_method: 'Essentiel sans moyen de paiement',
  ontime_contest_pending: 'Contestation OnTime à trancher',
  ontime_suspended: 'OnTime suspendue',
  ontime_warning: 'Avertissement OnTime',
  ontime_threshold_reached: 'Seuil de suspension OnTime atteint',
  ontime_withdrawn: 'OnTime retirée',
  closure_pending: 'Clôture en cours',
};

/** Libellé d'un type ; un type inconnu (types futurs) ne fait jamais planter l'écran. */
export function alertKindLabel(kind: string): string {
  return ALERT_KIND_LABELS[kind] ?? 'Autre alerte';
}

/** Libellé d'une alerte, précisé par ses chiffres quand le type en dépend. */
export function alertLabel(alert: { kind: string; metrics?: Record<string, unknown> | null }): string {
  if (alert.kind === 'commission_billing_suspended' && alert.metrics?.online_bookings_blocked === true) {
    return 'Commissions impayées : réservations en ligne coupées';
  }
  return alertKindLabel(alert.kind);
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

const PLAN_LABELS: Record<string, string> = {
  essentiel: 'Essentiel', croissance: 'Croissance', liberte: 'Liberté', premium: 'Liberté', free: 'Essentiel',
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Nouvelles tentatives épuisées',
  paused: 'Abonnement en pause',
  incomplete_expired: 'Premier paiement jamais abouti',
};

const DISPUTE_SOURCE_LABELS: Record<string, string> = {
  invoice: 'facture', dine_in: 'sur place', booking_unmatched: 'réservation introuvable', other: 'autre',
};

/** Détail court d'une alerte, d'après ses chiffres connus ; null pour un type sans détail. */
export function alertDetail(alert: { kind: string; severity?: string; metrics: Record<string, unknown> }): string | null {
  const m = alert.metrics ?? {};
  const n = (key: string) => (typeof m[key] === 'number' ? (m[key] as number) : Number.NaN);
  const has = (key: string) => Number.isFinite(n(key));
  const euro = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
  const cents = (key: string) => euro(n(key) / 100);
  const text = (key: string) => (typeof m[key] === 'string' ? (m[key] as string) : null);
  const plan = (key: string) => {
    const v = text(key);
    return v ? (PLAN_LABELS[v] ?? v) : null;
  };
  const list = (key: string) =>
    (Array.isArray(m[key]) ? (m[key] as unknown[]).filter((v): v is string => typeof v === 'string') : []);
  const join = (parts: (string | null)[]) => parts.filter(Boolean).join(' · ') || null;
  const unpaid = () =>
    `${n('unpaid_invoices')} facture(s) impayée(s)${has('unpaid_amount_ht') ? `, ${euro(n('unpaid_amount_ht'))} HT` : ''}`;
  switch (alert.kind) {
    case 'pending_lapse':
      return has('lapsed_30d') && has('total_30d')
        ? `${n('lapsed_30d')} sur ${n('total_30d')} demandes en 30 jours (${formatRate(n('rate_30d'))})`
        : null;
    case 'commission_billing_suspended':
      if (!has('unpaid_invoices')) return null;
      return join([
        unpaid(),
        m.online_bookings_blocked === true
          ? 'réservations en ligne coupées'
          : plan('plan') ? `formule ${plan('plan')}, réservations en ligne ouvertes` : null,
      ]);
    case 'commission_invoice_failed':
      if (!has('unpaid_invoices')) return null;
      return join([unpaid(), text('suspension_from') ? `suspension possible le ${formatInstant(text('suspension_from'), false)}` : null]);
    case 'privatization_incident_open':
      return has('open_incidents') ? `${n('open_incidents')} incident(s) ouvert(s)` : null;
    case 'subscription_past_due':
      return join([
        plan('plan') ? `Formule ${plan('plan')}` : null,
        text('suspension_from') ? `suspension possible le ${formatInstant(text('suspension_from'), false)} (CGV 6.5)` : null,
      ]);
    case 'subscription_unpaid':
      return join([SUBSCRIPTION_STATUS_LABELS[text('status') ?? ''] ?? null, plan('plan') ? `formule actuelle ${plan('plan')}` : null]);
    case 'dispute_open':
      if (!has('open_disputes')) return null;
      return join([
        `${n('open_disputes')} litige(s) ouvert(s)${has('amount_cents') ? `, ${cents('amount_cents')}` : ''}`,
        text('evidence_due_by') ? `réponse avant le ${formatInstant(text('evidence_due_by'))}` : null,
      ]);
    case 'dispute_lost':
      if (!has('lost_disputes_30d')) return null;
      return `${n('lost_disputes_30d')} litige(s) perdu(s) en 30 jours${has('amount_cents') ? `, ${cents('amount_cents')}` : ''}`
        + (has('fee_cents') ? ` + ${cents('fee_cents')} de frais` : '');
    case 'dispute_reversed_after_billing':
      if (!has('disputes')) return null;
      return `${n('disputes')} litige(s)${has('billed_amount_ht') ? `, ${euro(n('billed_amount_ht'))} HT déjà facturés` : ''} : avoir à faire à la main`;
    case 'dispute_other_open': {
      if (!has('open_disputes')) return null;
      const sources = list('sources').map((s) => DISPUTE_SOURCE_LABELS[s] ?? s);
      return `${n('open_disputes')} litige(s)${has('amount_cents') ? `, ${cents('amount_cents')}` : ''}`
        + (sources.length ? ` (${sources.join(', ')})` : '');
    }
    case 'recharge_recovery_failed': {
      if (!has('recoveries')) return null;
      const errors = list('errors');
      return join([
        `${n('recoveries')} reprise(s)${has('missing_cents') ? `, ${cents('missing_cents')} non repris` : ''}`,
        errors.length ? `erreurs Stripe : ${errors.join(', ')}` : null,
        alert.severity === 'critical' ? 'abandonnée après 5 essais' : null,
      ]);
    }
    case 'ontime_contest_pending':
      if (!has('contested_reports')) return null;
      return `${n('contested_reports')} contestation(s)${has('oldest_days') ? `, la plus ancienne depuis ${n('oldest_days')} jour(s)` : ''}`;
    case 'ontime_suspended':
      return join([
        text('ends_at') ? `Jusqu'au ${formatInstant(text('ends_at'))}` : null,
        has('failures') && has('served') ? `${n('failures')} manquement(s) sur ${n('served')} servie(s)` : null,
        m.recidive === true ? 'récidive : retrait à envisager' : null,
      ]);
    case 'ontime_warning':
      return join([
        has('failures') && has('served') ? `${n('failures')} manquement(s) sur ${n('served')} servie(s) (${formatRate(n('rate'))})` : null,
        m.acknowledged === true ? 'engagement confirmé' : m.acknowledged === false ? 'engagement non confirmé' : null,
      ]);
    case 'ontime_threshold_reached':
      if (!has('failures_30d') || !has('served_30d')) return null;
      return join([
        `${n('failures_30d')} manquement(s) sur ${n('served_30d')} servie(s) en 30 jours (${formatRate(n('rate_30d'))})`,
        m.sanctions_enabled === false ? 'sanctions éteintes : aucune suspension appliquée' : null,
      ]);
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
