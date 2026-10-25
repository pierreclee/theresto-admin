// Commissions de réservation du plan Essentiel (Edge Function commission-settings).

/** Tarif global (montants HT en euros). */
export interface CommissionSettings {
  tableFeeHt: number;
  guestFeeHt: number;
  /** Total mensuel en dessous duquel la facture est reportée. */
  minInvoiceHt: number;
  /** Nombre maximal de mois de report. */
  maxCarryMonths: number;
  updatedAt: string;
}

export interface CommissionMonthlyTotal {
  /** Mois facturé (YYYY-MM-01). */
  period: string;
  invoicedHt: number;
  paidHt: number;
  invoiceCount: number;
}

export type CommissionInvoiceStatus = 'draft' | 'open' | 'paid' | 'failed' | 'uncollectible' | 'void';

export interface CommissionInvoiceSummary {
  id: string;
  period: string;
  bookingCount: number;
  guestCount: number;
  amountHt: number;
  status: CommissionInvoiceStatus;
  hostedInvoiceUrl: string | null;
}

/** Taux globaux d'une commission en pourcentage, par plan (paiements en ligne, privatisations). */
export interface PlanCommissionRates {
  croissance: number;
  liberte: number;
  updatedAt: string;
}

/** Taux d'une commission en pourcentage pour un restaurant (paiements en ligne, privatisations). */
export interface RestaurantPlanRate {
  /** Taux appliqué aux paiements (%). */
  effective: number;
  /** Taux particulier, null si le restaurant suit le taux de son plan. */
  custom: number | null;
  /** Taux du plan actuel du restaurant. */
  planRate: number;
  /** Dernière modification depuis l'admin (null si jamais modifié). */
  updatedAt: string | null;
}

/** Tarif effectif d'un restaurant (personnalisé ou global) et état de facturation. */
export interface RestaurantCommission {
  tableFeeHt: number;
  guestFeeHt: number;
  isCustom: boolean;
  /** Dernière modification du tarif personnalisé (null si jamais modifié). */
  updatedAt: string | null;
  /** null si le restaurant n'a pas de plan renseigné. */
  subscriptionPlan: string | null;
  paymentMethodReady: boolean;
  suspended: boolean;
  invoices: CommissionInvoiceSummary[];
  /** Commission des paiements en ligne (Stripe Connect). */
  onlineRate: RestaurantPlanRate | null;
  /** Commission des paiements de privatisation. */
  privatizationRate: RestaurantPlanRate | null;
}
