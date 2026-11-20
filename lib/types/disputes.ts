// Litiges, refacturations, reprises (chantier C, lots C2 et C3) et remboursements de commission
// des incidents CRM (lot C1). Contrats : docs/features/booking-commissions.md §13 et
// docs/features/payment-system.md du dépôt theresto_app (migrations 20261130200100,
// 20261130200400, 20261130210000, 20261130220200, 20261130220300).
// Aucune donnée de client : ni nom, ni contact, ni identifiant de réservation ou de paiement
// (seuls les identifiants Stripe utiles au lien vers le tableau de bord sont gardés).

/** Litige d'un paiement de réservation (booking_disputes) ou hors réservation (platform_disputes). */
export interface DisputeRow {
  stripeDisputeId: string;
  /** booking : paiement de réservation ; platform : facture, dine-in, réservation introuvable… */
  scope: 'booking' | 'platform';
  restaurantId: string | null;
  restaurantName: string | null;
  /** booking : main, delta, guest, deposit ; platform : invoice, dine_in, booking_unmatched, other. */
  kind: string;
  bookingDate: string | null;
  amountCents: number;
  feeCents: number | null;
  currency: string;
  reason: string | null;
  status: string;
  evidenceDueBy: string | null;
  openedAt: string;
  closedAt: string | null;
  livemode: boolean;
}

export type DisputeFilter = 'open' | 'all';

export interface DisputesResult {
  disputes: DisputeRow[];
  /** Vrai si la liste a été tronquée à la limite de lecture. */
  truncated: boolean;
}

/** Ligne de restaurant_recharges (somme refacturée sur la facture de commissions du mois). */
export interface RechargeRow {
  id: string;
  kind: string;
  amountHt: number;
  bookingDate: string | null;
  period: string;
  occurredAt: string;
  /** Statut de la facture de rattachement, null tant qu'elle n'est pas facturée. */
  invoiceStatus: string | null;
  invoicePeriod: string | null;
}

/** Reprise des refacturations impayées par annulation de virement (commission_recharge_recoveries). */
export interface RecoveryRow {
  invoiceId: string;
  invoicePeriod: string | null;
  stripeInvoiceId: string | null;
  dueCents: number;
  recoveredCents: number;
  creditedCents: number;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
}

export interface RestaurantRechargesResult {
  recharges: RechargeRow[];
  recoveries: RecoveryRow[];
  disputes: DisputeRow[];
  /** Listes tronquées à leur limite de lecture (les plus récentes seulement). */
  truncated: { recharges: boolean; recoveries: boolean; disputes: boolean };
  livemode: boolean;
}

/** Incident CRM dont la commission rendue au restaurant n'a pas pu être remboursée chez Stripe. */
export interface IncidentCommissionRefundRow {
  incidentId: string;
  restaurantId: string;
  restaurantName: string | null;
  incidentType: string;
  refundAmount: number | null;
  refundStatus: string | null;
  refundStripeId: string | null;
  applicationFeeId: string | null;
  commissionDueCents: number;
  commissionRefundedCents: number;
  attempts: number;
  failedAt: string | null;
  nextAttemptAt: string | null;
  /** abandoned : 6 essais en échec (plus repris) ; retrying : reprise programmée ; pending : ni l'un ni l'autre (ne devrait pas arriver). */
  state: 'abandoned' | 'retrying' | 'pending';
}

export interface IncidentCommissionRefundsResult {
  incidents: IncidentCommissionRefundRow[];
  /** Vrai si la liste a été tronquée à la limite de lecture (500 incidents les plus récents). */
  truncated: boolean;
  livemode: boolean;
}
