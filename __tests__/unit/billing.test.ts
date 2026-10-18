// __tests__/unit/billing.test.ts
import {
  billingDrift,
  centsToEuro,
  formatDateFr,
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

  it('pas d\'abonnement Stripe et statut en base nul : aucun écart', () => {
    const drift = billingDrift({ ...overview, subscription: null, database: { ...overview.database, status: null } });
    expect(drift.size).toBe(0);
  });

  it('pas d\'abonnement Stripe et statut en base résilié : aucun écart', () => {
    const drift = billingDrift({ ...overview, subscription: null, database: { ...overview.database, status: 'canceled' } });
    expect(drift.size).toBe(0);
  });

  it('pas d\'abonnement Stripe mais base active : écart de statut', () => {
    expect([...billingDrift({ ...overview, subscription: null })]).toEqual(['status']);
  });

  it('fin de période : tolérance de moins d\'une minute, y compris à cheval sur la minute', () => {
    const withEnd = (stripe: string | null, db: string | null) =>
      billingDrift({
        ...overview,
        subscription: { ...overview.subscription!, currentPeriodEnd: stripe },
        database: { ...overview.database, periodEnd: db },
      });
    expect(withEnd('2026-11-01T12:00:59Z', '2026-11-01T12:01:00Z').has('periodEnd')).toBe(false);
    expect(withEnd('2026-11-01T12:00:00Z', '2026-11-01T12:02:00Z').has('periodEnd')).toBe(true);
    expect(withEnd(null, '2026-11-01T12:00:00Z').has('periodEnd')).toBe(true);
    expect(withEnd('2026-11-01T12:00:00Z', null).has('periodEnd')).toBe(true);
    expect(withEnd(null, null).has('periodEnd')).toBe(false);
  });
});

describe('formatDateFr', () => {
  it('affiche la date à Paris', () => {
    expect(formatDateFr('2026-10-05T23:30:00Z')).toBe('06/10/2026');
    expect(formatDateFr(null)).toBe('—');
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
