// Libellés et liens Stripe des litiges, refacturations, reprises et incidents (sans dépendance serveur).

const STRIPE_ID = /^[a-z]{2,4}_[A-Za-z0-9_]{1,200}$/;
const STRIPE_PATHS: Record<string, string> = {
  du: 'disputes', dp: 'disputes', re: 'refunds', fee: 'connect/application_fees', in: 'invoices',
};

/**
 * Lien vers l'objet dans le tableau de bord Stripe de la plateforme, d'après le préfixe de son id
 * (du_/dp_ litige, re_ remboursement, fee_ application fee, in_ facture) ; null pour un id inconnu.
 */
export function stripeDashboardUrl(id: string | null | undefined, livemode: boolean): string | null {
  if (!id || !STRIPE_ID.test(id)) return null;
  const path = STRIPE_PATHS[id.slice(0, id.indexOf('_'))];
  if (!path) return null;
  return `https://dashboard.stripe.com/${livemode ? '' : 'test/'}${path}/${encodeURIComponent(id)}`;
}

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  warning_needs_response: 'Demande d’information, réponse attendue',
  warning_under_review: 'Demande d’information en examen',
  warning_closed: 'Demande d’information close',
  needs_response: 'Réponse attendue',
  under_review: 'En examen par la banque',
  won: 'Gagné',
  lost: 'Perdu',
  prevented: 'Évité',
};

export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABELS[status] ?? status;
}

export function isDisputeOpen(status: string): boolean {
  return ['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'].includes(status);
}

export function disputeStatusClasses(status: string): string {
  if (status === 'lost') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'won' || status === 'prevented') return 'bg-green-50 text-green-700 border-green-200';
  if (status.endsWith('needs_response')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (isDisputeOpen(status)) return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

export const DISPUTE_KIND_LABELS: Record<string, string> = {
  main: 'Paiement de la réservation',
  delta: 'Différence après modification',
  guest: 'Part d’un invité',
  deposit: 'Empreinte encaissée',
  invoice: 'Facture (abonnement ou commissions)',
  dine_in: 'Commande sur place',
  booking_unmatched: 'Réservation introuvable',
  other: 'Autre paiement',
};

export function disputeKindLabel(kind: string): string {
  return DISPUTE_KIND_LABELS[kind] ?? kind;
}

const DISPUTE_REASON_LABELS: Record<string, string> = {
  fraudulent: 'Fraude',
  duplicate: 'Doublon',
  product_not_received: 'Non reçu',
  product_unacceptable: 'Non conforme',
  subscription_canceled: 'Abonnement résilié',
  credit_not_processed: 'Remboursement non reçu',
  unrecognized: 'Non reconnu',
  general: 'Général',
};

export function disputeReasonLabel(reason: string | null): string {
  if (!reason) return '—';
  return DISPUTE_REASON_LABELS[reason] ?? reason;
}

export const RECHARGE_KIND_LABELS: Record<string, string> = {
  service_fee_cancellation: 'Frais de service rendus (annulation ou refus par le restaurant)',
  dispute_lost: 'Litige perdu : montant contesté',
  dispute_fee: 'Litige perdu : frais de la banque',
};

export function rechargeKindLabel(kind: string): string {
  return RECHARGE_KIND_LABELS[kind] ?? kind;
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', open: 'Envoyée', paid: 'Payée', failed: 'Prélèvement en échec', uncollectible: 'Irrécouvrable', void: 'Annulée',
};

export const RECOVERY_STATUS_LABELS: Record<string, string> = {
  pending: 'À reprendre',
  partial: 'Reprise partielle',
  recovered: 'Reprise',
  failed: 'Abandonnée (5 essais)',
  cancelled: 'Annulée (facture réglée)',
};

export const INCIDENT_COMMISSION_STATE_LABELS: Record<string, string> = {
  abandoned: 'Abandonné : à traiter à la main',
  retrying: 'Nouvel essai programmé',
  pending: 'Pas encore tenté',
};

/** Montant en centimes → « 12,34 € » (devise du litige, euro par défaut). */
export function formatCents(cents: number | null | undefined, currency = 'eur'): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** « novembre 2026 » depuis une période « AAAA-MM-01 ». */
export function formatMonth(period: string | null | undefined): string {
  if (!period) return '—';
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
