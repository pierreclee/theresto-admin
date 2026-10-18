// lib/utils/billing.ts
import { formatEuro } from '@/lib/utils/commissionRates';
import type { PaymentMethodSummary, RevenueCategory, StripeOverview } from '@/lib/types/billing';

export type DriftField = 'status' | 'priceId' | 'periodEnd' | 'cancelAtPeriodEnd';

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: 'Essai',
  active: 'Actif',
  past_due: 'Impayé',
  unpaid: 'Impayé (suspendu)',
  canceled: 'Résilié',
  incomplete: 'Incomplet',
  incomplete_expired: 'Expiré',
  paused: 'En pause',
};

export const REVENUE_CATEGORY_LABELS: Record<RevenueCategory, string> = {
  subscription: 'Abonnement',
  booking_commission: 'Commissions',
  application_fee: 'Frais sur paiements en ligne',
  monthly_fee: 'Frais mensuels SEPA',
};

export const REVENUE_CATEGORY_ORDER: RevenueCategory[] = [
  'subscription',
  'booking_commission',
  'application_fee',
  'monthly_fee',
];

export function centsToEuro(cents: number): string {
  return formatEuro(cents / 100);
}

export function formatDateFr(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso));
}

/** Même instant à moins d'une minute près (Stripe est à la seconde, la base peut être arrondie). */
function sameMinute(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60_000;
}

/** La base indique un abonnement en cours alors que Stripe n'en a pas. */
export function databaseHasLiveStatus(status: string | null): boolean {
  return status !== null && status !== 'canceled';
}

/** Champs de la ligne restaurants qui ne suivent pas l'abonnement Stripe. */
export function billingDrift(overview: StripeOverview): Set<DriftField> {
  const drift = new Set<DriftField>();
  const { subscription, database } = overview;
  if (!subscription) {
    if (databaseHasLiveStatus(database.status)) drift.add('status');
    return drift;
  }
  if (subscription.status !== database.status) drift.add('status');
  if (subscription.priceId !== database.priceId) drift.add('priceId');
  if (!sameMinute(subscription.currentPeriodEnd, database.periodEnd)) drift.add('periodEnd');
  if (subscription.cancelAtPeriodEnd !== database.cancelAtPeriodEnd) drift.add('cancelAtPeriodEnd');
  return drift;
}

export function safeStripeDashboardUrl(url: string | null): string | null {
  return url && url.startsWith('https://dashboard.stripe.com/') ? url : null;
}

export function paymentMethodLabel(pm: PaymentMethodSummary | null): string {
  if (!pm) return 'Aucun';
  const suffix = pm.last4 ? ` •••• ${pm.last4}` : '';
  if (pm.type === 'card') return ['Carte', pm.brand?.toUpperCase()].filter(Boolean).join(' ') + suffix;
  if (pm.type === 'sepa_debit') return `Prélèvement SEPA${suffix}`;
  return pm.type;
}
