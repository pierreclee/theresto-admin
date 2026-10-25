// Incidents de paiement des privatisations (Edge Function admin-privatization-incidents).

export type PrivatizationIncidentKind =
  | 'refund_failed'
  | 'refund_awaiting_iban'
  | 'paid_after_cancellation'
  | 'customer_balance_funds';

export type PrivatizationIncidentStatus = 'open' | 'resolved' | 'ignored';

export type PrivatizationIncidentFilter = PrivatizationIncidentStatus | 'all';

export type PrivatizationIncidentAction = 'retryRefund' | 'returnCustomerBalance' | 'resolve';

export type IncidentMoneyAction = Exclude<PrivatizationIncidentAction, 'resolve'>;

export interface PrivatizationIncident {
  id: string;
  kind: PrivatizationIncidentKind;
  status: PrivatizationIncidentStatus;
  /** Montant en euros. */
  amount: number | null;
  restaurantId: string | null;
  restaurantName: string | null;
  privatizationId: string | null;
  privatization: {
    date: string | null;
    organizerName: string | null;
    organizerEmail: string | null;
    status: string | null;
    occasionType: string | null;
    totalPrice: number | null;
    paymentStatus: string | null;
  } | null;
  paymentId: string | null;
  stripeAccountId: string | null;
  stripeObjectId: string | null;
  details: Record<string, unknown>;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Actions possibles (vide si l'incident est traité). */
  actions: PrivatizationIncidentAction[];
}

export interface IncidentMoneyResult {
  status: 'open' | 'resolved';
  refundedAmount?: number;
  returnedAmount?: number;
  refundStatus?: string;
  auditLogged?: boolean;
}
