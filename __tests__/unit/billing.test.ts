// __tests__/unit/billing.test.ts
import {
  billingDrift,
  centsToEuro,
  paymentMethodLabel,
  safeStripeDashboardUrl,
} from '@/lib/utils/billing';
import { formatEuro } from '@/lib/utils/commissionRates';
import type { StripeOverview } from '@/lib/types/billing';

const overview: StripeOverview = {
  customer: { id: 'cus_1', email: 'a@b.fr', livemode: false, paymentMethod: null },
  subscription: {
    id: 'sub_1',
    status: 'active',
    priceId: 'price_1',
    productName: 'Croissance',
    currentPeriodEnd: '2026-11-01T12:00:30.000Z',
    cancelAtPeriodEnd: false,
  },
  upcomingInvoice: null,
  database: { status: 'active', priceId: 'price_1', periodEnd: '2026-11-01T12:00:00+00:00', cancelAtPeriodEnd: false },
  dashboardUrl: 'https://dashboard.stripe.com/test/customers/cus_1',
};

describe('billingDrift', () => {
  it('aucun écart quand la base suit Stripe (fin de période à la minute près)', () => {
    expect(billingDrift(overview).size).toBe(0);
  });

  it('signale chaque champ différent', () => {
    const drift = billingDrift({
      ...overview,
      database: { status: 'past_due', priceId: 'price_old', periodEnd: '2026-10-01T12:00:00Z', cancelAtPeriodEnd: true },
    });
    expect([...drift].sort()).toEqual(['cancelAtPeriodEnd', 'periodEnd', 'priceId', 'status']);
  });

  it('pas d\'abonnement Stripe : aucun écart calculé', () => {
    expect(billingDrift({ ...overview, subscription: null }).size).toBe(0);
  });
});

describe('safeStripeDashboardUrl', () => {
  it('accepte uniquement le dashboard Stripe en https', () => {
    expect(safeStripeDashboardUrl('https://dashboard.stripe.com/customers/cus_1')).toBe(
      'https://dashboard.stripe.com/customers/cus_1',
    );
    expect(safeStripeDashboardUrl('https://evil.example/customers')).toBeNull();
    expect(safeStripeDashboardUrl('javascript:alert(1)')).toBeNull();
    expect(safeStripeDashboardUrl(null)).toBeNull();
  });
});

describe('paymentMethodLabel', () => {
  it('carte, SEPA, autre, aucun', () => {
    expect(paymentMethodLabel({ type: 'card', brand: 'visa', last4: '4242' })).toBe('Carte VISA •••• 4242');
    expect(paymentMethodLabel({ type: 'sepa_debit', brand: null, last4: '3000' })).toBe('Prélèvement SEPA •••• 3000');
    expect(paymentMethodLabel({ type: 'paypal', brand: null, last4: null })).toBe('paypal');
    expect(paymentMethodLabel(null)).toBe('Aucun');
  });
});

describe('centsToEuro', () => {
  it('formate des centimes en euros', () => {
    expect(centsToEuro(2900)).toBe(formatEuro(29));
    expect(centsToEuro(0)).toBe(formatEuro(0));
  });
});
