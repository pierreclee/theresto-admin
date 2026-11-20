'use server';

// Litiges, refacturations et reprises (chantier C, lots C2 et C3), remboursements de commission
// des incidents CRM restés en échec (lot C1). Lecture seule, clé service, après requireAdmin().
// Contrats : docs/features/booking-commissions.md §13 et docs/features/payment-system.md du dépôt
// theresto_app. Tables écrites par le serveur seul (RLS sans policy, SELECT pour service_role).
//
// Colonnes lues : identifiants Stripe, montants, statuts, dates ; jamais booking_id, le PaymentIntent,
// la charge, le client de l'incident (customer_id) ni sa description. Ces lectures portent sur
// l'activité financière d'établissements nommés : journalisées comme la fiche d'un restaurant, et
// refusées (adminLogRefusal) si le journal ne s'écrit pas (D2).

import { getAdminClient, getServerEnvironment, requireAdmin } from '@/lib/supabase/server';
import { adminLogRefusal, logAdminAction } from '@/lib/audit/adminLog';
import type { ActionResult } from '@/lib/supabase/invokeFunction';
import type {
  DisputeFilter,
  DisputeRow,
  DisputesResult,
  IncidentCommissionRefundRow,
  IncidentCommissionRefundsResult,
  RechargeRow,
  RecoveryRow,
  RestaurantRechargesResult,
} from '@/lib/types/disputes';
import {
  INCIDENT_COMMISSION_LIMIT,
  RECHARGES_LIMIT,
  RECOVERIES_LIMIT,
  RESTAURANT_DISPUTES_LIMIT,
} from '@/lib/utils/disputes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Statuts non finaux d'un litige Stripe (dispute_status_final en SQL). */
const OPEN_DISPUTE_STATUSES = ['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'];
const LIST_LIMIT = 500;

const BOOKING_DISPUTE_COLUMNS =
  'stripe_dispute_id, restaurant_id, booking_date, payment_kind, amount_cents, fee_cents, currency, reason, status, evidence_due_by, opened_at, closed_at, livemode';
const PLATFORM_DISPUTE_COLUMNS =
  'stripe_dispute_id, restaurant_id, source, amount_cents, currency, reason, status, opened_at, closed_at, livemode';
const INCIDENT_COLUMNS =
  'id, restaurant_id, type, refund_amount, refund_status, refund_stripe_id, refund_application_fee_id, refund_commission_due_cents, refund_commission_cents, refund_commission_attempts, refund_commission_failed_at, refund_commission_next_at, created_at';

type DbError = { code?: string; message?: string } | null;
type Row = Record<string, unknown>;

function dbFailure(error: DbError, fallback: string): { ok: false; code: string; error: string } {
  console.error('[litiges] refus de la base :', error?.code ?? 'erreur');
  return { ok: false, code: error?.code ?? 'internal', error: fallback };
}

const str = (v: unknown) => (typeof v === 'string' ? v : null);
const int = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function toBookingDispute(r: Row, names: Map<string, string | null>): DisputeRow {
  const rid = str(r.restaurant_id);
  return {
    stripeDisputeId: String(r.stripe_dispute_id),
    scope: 'booking',
    restaurantId: rid,
    restaurantName: rid ? (names.get(rid) ?? null) : null,
    kind: String(r.payment_kind),
    bookingDate: str(r.booking_date),
    amountCents: int(r.amount_cents),
    feeCents: numOrNull(r.fee_cents),
    currency: str(r.currency) ?? 'eur',
    reason: str(r.reason),
    status: String(r.status),
    evidenceDueBy: str(r.evidence_due_by),
    openedAt: String(r.opened_at),
    closedAt: str(r.closed_at),
    livemode: r.livemode === true,
  };
}

function toPlatformDispute(r: Row, names: Map<string, string | null>): DisputeRow {
  const rid = str(r.restaurant_id);
  return {
    stripeDisputeId: String(r.stripe_dispute_id),
    scope: 'platform',
    restaurantId: rid,
    restaurantName: rid ? (names.get(rid) ?? null) : null,
    kind: String(r.source),
    bookingDate: null,
    amountCents: int(r.amount_cents),
    feeCents: null,
    currency: str(r.currency) ?? 'eur',
    reason: str(r.reason),
    status: String(r.status),
    evidenceDueBy: null,
    openedAt: String(r.opened_at),
    closedAt: str(r.closed_at),
    livemode: r.livemode === true,
  };
}

async function restaurantNames(db: Awaited<ReturnType<typeof getAdminClient>>, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const names = new Map<string, string | null>();
  if (unique.length === 0) return { names, error: null as DbError };
  const { data, error } = await db.from('restaurants').select('id, name').in('id', unique);
  for (const r of (data ?? []) as { id: string; name: string | null }[]) names.set(r.id, r.name);
  return { names, error: error as DbError };
}

/** Litiges des paiements de réservation et hors réservation (litiges sans restaurant compris). */
export async function listDisputesAction(filter: DisputeFilter = 'open'): Promise<ActionResult<DisputesResult>> {
  const admin = await requireAdmin();
  const onlyOpen = filter !== 'all';
  const db = await getAdminClient();

  let bookingQuery = db.from('booking_disputes').select(BOOKING_DISPUTE_COLUMNS).order('opened_at', { ascending: false }).limit(LIST_LIMIT);
  let platformQuery = db.from('platform_disputes').select(PLATFORM_DISPUTE_COLUMNS).order('opened_at', { ascending: false }).limit(LIST_LIMIT);
  if (onlyOpen) {
    bookingQuery = bookingQuery.in('status', OPEN_DISPUTE_STATUSES);
    platformQuery = platformQuery.in('status', OPEN_DISPUTE_STATUSES);
  }
  const [booking, platform] = await Promise.all([bookingQuery, platformQuery]);
  if (booking.error) return dbFailure(booking.error, 'Impossible de charger les litiges.');
  if (platform.error) return dbFailure(platform.error, 'Impossible de charger les litiges.');
  const bookingRows = (booking.data ?? []) as Row[];
  const platformRows = (platform.data ?? []) as Row[];
  const { names, error } = await restaurantNames(db, [...bookingRows, ...platformRows].map((r) => str(r.restaurant_id)));
  if (error) return dbFailure(error, 'Impossible de charger les litiges.');

  const disputes = [
    ...bookingRows.map((r) => toBookingDispute(r, names)),
    ...platformRows.map((r) => toPlatformDispute(r, names)),
  ].sort((a, b) => (onlyOpen
    ? (a.evidenceDueBy ?? '9999').localeCompare(b.evidenceDueBy ?? '9999') || b.openedAt.localeCompare(a.openedAt)
    : b.openedAt.localeCompare(a.openedAt)));

  const logged = await logAdminAction(admin, {
    action: 'view_disputes',
    targetType: 'restaurant',
    targetId: null,
    details: { filter: onlyOpen ? 'open' : 'all', count: disputes.length },
  });
  if (!logged) return adminLogRefusal();
  return {
    ok: true,
    data: { disputes, truncated: bookingRows.length >= LIST_LIMIT || platformRows.length >= LIST_LIMIT },
  };
}

/** Refacturations, reprises et litiges d'un restaurant (fiche). */
export async function getRestaurantRechargesAction(restaurantId: string): Promise<ActionResult<RestaurantRechargesResult>> {
  const admin = await requireAdmin();
  if (typeof restaurantId !== 'string' || !UUID.test(restaurantId)) {
    return { ok: false, code: 'not-found', error: 'Restaurant introuvable.' };
  }
  const db = await getAdminClient();
  const [recharges, recoveries, bookingDisputes, platformDisputes, restaurant] = await Promise.all([
    db.from('restaurant_recharges')
      .select('id, kind, amount_ht, booking_date, period, occurred_at, invoice_id')
      .eq('restaurant_id', restaurantId)
      .order('occurred_at', { ascending: false })
      .limit(RECHARGES_LIMIT),
    db.from('commission_recharge_recoveries')
      .select('invoice_id, due_cents, recovered_cents, credited_cents, status, attempts, last_error, next_attempt_at, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(RECOVERIES_LIMIT),
    db.from('booking_disputes').select(BOOKING_DISPUTE_COLUMNS).eq('restaurant_id', restaurantId)
      .order('opened_at', { ascending: false }).limit(RESTAURANT_DISPUTES_LIMIT),
    db.from('platform_disputes').select(PLATFORM_DISPUTE_COLUMNS).eq('restaurant_id', restaurantId)
      .order('opened_at', { ascending: false }).limit(RESTAURANT_DISPUTES_LIMIT),
    db.from('restaurants').select('id, name').eq('id', restaurantId).maybeSingle(),
  ]);
  for (const r of [recharges, recoveries, bookingDisputes, platformDisputes, restaurant]) {
    if (r.error) return dbFailure(r.error, 'Impossible de charger les refacturations.');
  }
  if (!restaurant.data) return { ok: false, code: 'not-found', error: 'Restaurant introuvable.' };

  const rechargeRows = (recharges.data ?? []) as Row[];
  const recoveryRows = (recoveries.data ?? []) as Row[];
  const invoiceIds = [...new Set([...rechargeRows, ...recoveryRows].map((r) => str(r.invoice_id)).filter((id): id is string => !!id))];
  const invoices = new Map<string, { status: string; period: string; stripe_invoice_id: string | null }>();
  if (invoiceIds.length > 0) {
    const { data, error } = await db.from('commission_invoices').select('id, status, period, stripe_invoice_id').in('id', invoiceIds);
    if (error) return dbFailure(error, 'Impossible de charger les refacturations.');
    for (const i of (data ?? []) as { id: string; status: string; period: string; stripe_invoice_id: string | null }[]) {
      invoices.set(i.id, i);
    }
  }
  const names = new Map<string, string | null>([[restaurantId, (restaurant.data as { name: string | null }).name]]);

  const result: RestaurantRechargesResult = {
    recharges: rechargeRows.map((r): RechargeRow => {
      const inv = str(r.invoice_id) ? invoices.get(String(r.invoice_id)) : undefined;
      return {
        id: String(r.id),
        kind: String(r.kind),
        amountHt: Number(r.amount_ht),
        bookingDate: str(r.booking_date),
        period: String(r.period),
        occurredAt: String(r.occurred_at),
        invoiceStatus: inv?.status ?? null,
        invoicePeriod: inv?.period ?? null,
      };
    }),
    recoveries: recoveryRows.map((r): RecoveryRow => {
      const inv = invoices.get(String(r.invoice_id));
      return {
        invoiceId: String(r.invoice_id),
        invoicePeriod: inv?.period ?? null,
        stripeInvoiceId: inv?.stripe_invoice_id ?? null,
        dueCents: int(r.due_cents),
        recoveredCents: int(r.recovered_cents),
        creditedCents: int(r.credited_cents),
        status: String(r.status),
        attempts: int(r.attempts),
        lastError: str(r.last_error),
        nextAttemptAt: str(r.next_attempt_at),
        createdAt: String(r.created_at),
      };
    }),
    disputes: [
      ...((bookingDisputes.data ?? []) as Row[]).map((r) => toBookingDispute(r, names)),
      ...((platformDisputes.data ?? []) as Row[]).map((r) => toPlatformDispute(r, names)),
    ].sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    truncated: {
      recharges: rechargeRows.length >= RECHARGES_LIMIT,
      recoveries: recoveryRows.length >= RECOVERIES_LIMIT,
      disputes: (bookingDisputes.data ?? []).length >= RESTAURANT_DISPUTES_LIMIT
        || (platformDisputes.data ?? []).length >= RESTAURANT_DISPUTES_LIMIT,
    },
    livemode: (await getServerEnvironment()) === 'production',
  };

  const logged = await logAdminAction(admin, {
    action: 'view_restaurant_recharges',
    targetType: 'restaurant',
    targetId: restaurantId,
    details: { count: result.recharges.length, recoveries: result.recoveries.length, disputes: result.disputes.length },
  });
  if (!logged) return adminLogRefusal();
  return { ok: true, data: result };
}

/**
 * Incidents CRM dont la commission à rendre au restaurant (paiement v2) n'est pas encore rendue :
 * reprise programmée par cron-capture-retry (6 essais à intervalle doublé) ou abandonnée
 * (refund_commission_next_at NULL après le dernier échec : à traiter à la main).
 *
 * Filtre dans la requête, avant la limite : refund_commission_failed_at est posé par
 * complete_incident_refund dès que la commission due dépasse la commission rendue, gardé par
 * note_incident_commission_failure, et remis à NULL seulement par
 * record_incident_commission_refund quand la commission est rendue (migrations 20261130200100
 * et 20261130200400 de theresto_app). Un filtre après coup laisserait un incident abandonné
 * ancien hors des derniers incidents remboursés lus.
 */
export async function listIncidentCommissionRefundsAction(): Promise<ActionResult<IncidentCommissionRefundsResult>> {
  const admin = await requireAdmin();
  const db = await getAdminClient();
  const { data, error } = await db
    .from('incidents')
    .select(INCIDENT_COLUMNS)
    .gt('refund_commission_due_cents', 0)
    .not('refund_commission_failed_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(INCIDENT_COMMISSION_LIMIT);
  if (error) return dbFailure(error, 'Impossible de charger les incidents.');
  const fetched = (data ?? []) as Row[];
  // Défense en profondeur : une commission rendue en entier n'a rien à faire ici
  // (PostgREST ne compare pas deux colonnes).
  const rows = fetched.filter((r) => int(r.refund_commission_due_cents) > int(r.refund_commission_cents));
  const { names, error: namesError } = await restaurantNames(db, rows.map((r) => str(r.restaurant_id)));
  if (namesError) return dbFailure(namesError, 'Impossible de charger les incidents.');

  const incidents = rows.map((r): IncidentCommissionRefundRow => {
    const nextAt = str(r.refund_commission_next_at);
    const failedAt = str(r.refund_commission_failed_at);
    return {
      incidentId: String(r.id),
      restaurantId: String(r.restaurant_id),
      restaurantName: names.get(String(r.restaurant_id)) ?? null,
      incidentType: String(r.type ?? 'other'),
      refundAmount: numOrNull(r.refund_amount),
      refundStatus: str(r.refund_status),
      refundStripeId: str(r.refund_stripe_id),
      applicationFeeId: str(r.refund_application_fee_id),
      commissionDueCents: int(r.refund_commission_due_cents),
      commissionRefundedCents: int(r.refund_commission_cents),
      attempts: int(r.refund_commission_attempts),
      failedAt,
      nextAttemptAt: nextAt,
      state: nextAt ? 'retrying' : failedAt ? 'abandoned' : 'pending',
    };
  }).sort((a, b) => {
    const rank = { abandoned: 0, retrying: 1, pending: 2 } as const;
    return rank[a.state] - rank[b.state];
  });

  const logged = await logAdminAction(admin, {
    action: 'view_incident_commission_refunds',
    targetType: 'restaurant',
    targetId: null,
    details: { count: incidents.length, abandoned: incidents.filter((i) => i.state === 'abandoned').length },
  });
  if (!logged) return adminLogRefusal();
  return {
    ok: true,
    data: { incidents, truncated: fetched.length >= INCIDENT_COMMISSION_LIMIT, livemode: (await getServerEnvironment()) === 'production' },
  };
}
