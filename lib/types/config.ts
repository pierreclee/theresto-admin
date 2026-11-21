export interface PlatformConfig {
  currency: string;
  updatedAt?: Date;
}

export interface UpdatePlatformConfigInput {
  currency?: string;
}

export type PaidPlan = 'croissance' | 'liberte';

/** Prix courant d'un plan, lu depuis Stripe (Edge Function subscription-prices). */
export interface SubscriptionPriceInfo {
  plan: PaidPlan;
  priceId: string;
  productId: string;
  /** Montant mensuel en euros (ex. 124.5). */
  amount: number;
  currency: string;
  interval: string;
  /** Date de création du prix courant (ISO). */
  since: string;
}
