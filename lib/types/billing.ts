// lib/types/billing.ts
// Réponses de l'Edge Function admin-restaurant-billing et du RPC
// admin_restaurant_revenue_summary (montants en centimes).

export interface PaymentMethodSummary {
  type: string;
  brand: string | null;
  last4: string | null;
}

export interface StripeOverview {
  customer: { id: string; email: string | null; livemode: boolean; paymentMethod: PaymentMethodSummary | null } | null;
  subscription: {
    id: string;
    status: string;
    priceId: string | null;
    productName: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  upcomingInvoice: { amountDueCents: number; date: string | null } | null;
  database: { status: string | null; priceId: string | null; periodEnd: string | null; cancelAtPeriodEnd: boolean };
  dashboardUrl: string | null;
}

export type RevenueCategory = 'subscription' | 'booking_commission' | 'application_fee' | 'monthly_fee';

export interface RevenueCategorySummary {
  net_cents: number;
  last: { amount_cents: number; occurred_at: string } | null;
}

export interface RevenueSummary {
  currency: string;
  total_net_cents: number;
  categories: Record<RevenueCategory, RevenueCategorySummary>;
}

export type BackfillCounts = Record<RevenueCategory, { recorded: number; unresolved: number }>;
