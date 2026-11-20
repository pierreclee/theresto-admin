import {
  alertDetail,
  alertKindLabel,
  alertLabel,
  ALERT_KIND_LABELS,
  formatRate,
  groupAlertsByRestaurant,
  parseMinCount,
  parseRatePercent,
  percentToRate,
  rateToPercent,
} from '@/lib/utils/restaurantAlerts';

describe('seuils', () => {
  it.each([[10, 0.1], [7.3, 0.073], [0.01, 0.0001], [0, 0], [100, 1], [33.33, 0.3333]])('%p %% → %p', (p, r) => {
    expect(percentToRate(p)).toBe(r);
  });

  it.each([[-1], [100.01], [7.125], [Number.NaN], ['10'], [null]])('pourcentage refusé : %p', (p) => {
    expect(percentToRate(p)).toBeNull();
  });

  it('fraction → pourcentage affiché', () => {
    expect(rateToPercent(0.073)).toBe(7.3);
    expect(rateToPercent(0.1)).toBe(10);
  });

  it('saisie', () => {
    expect(parseRatePercent('7,5')).toBe(7.5);
    expect(parseRatePercent('7,555')).toBeNull();
    expect(parseRatePercent('abc')).toBeNull();
    expect(parseMinCount('5')).toBe(5);
    expect(parseMinCount('0')).toBeNull();
    expect(parseMinCount('1001')).toBeNull();
    expect(parseMinCount('2.5')).toBeNull();
  });
});

describe('affichage', () => {
  it('type inconnu : libellé générique, sans planter', () => {
    expect(alertKindLabel('pending_lapse')).toBe('Demandes non confirmées à la fin du service');
    expect(alertKindLabel('ontime_late')).toBe('Autre alerte');
    expect(alertDetail({ kind: 'ontime_late', metrics: { x: 1 } })).toBeNull();
  });

  it('taux et détail', () => {
    expect(formatRate(0.1)).toMatch(/^10\s%$/);
    expect(formatRate(null)).toBe('—');
    expect(alertDetail({ kind: 'pending_lapse', metrics: { lapsed_30d: 5, total_30d: 50, rate_30d: 0.1 } }))
      .toMatch(/^5 sur 50 demandes en 30 jours \(10\s%\)$/);
  });

  it('regroupement par restaurant, ordre de la base gardé', () => {
    const a = (id: string, kind: string) => ({ restaurantId: id, restaurantName: id, kind, severity: 'warning', since: null, metrics: {} });
    const groups = groupAlertsByRestaurant([a('r2', 'x'), a('r1', 'y'), a('r2', 'z')]);
    expect(groups.map((g) => [g.restaurantId, g.alerts.map((x) => x.kind)])).toEqual([['r2', ['x', 'z']], ['r1', ['y']]]);
  });
});

describe('types du chantier C', () => {
  const kinds = [
    'subscription_past_due', 'subscription_unpaid', 'dispute_open', 'dispute_lost', 'dispute_other_open',
    'dispute_reversed_after_billing', 'recharge_recovery_failed', 'commission_billing_suspended',
    'ontime_contest_pending', 'ontime_suspended', 'ontime_warning', 'ontime_threshold_reached', 'ontime_withdrawn',
  ];

  it.each(kinds)('%s a un libellé propre', (kind) => {
    expect(ALERT_KIND_LABELS[kind]).toBeTruthy();
    expect(alertKindLabel(kind)).not.toBe('Autre alerte');
  });

  it('impayé de commissions : coupure des réservations selon online_bookings_blocked', () => {
    const blocked = { kind: 'commission_billing_suspended', metrics: { unpaid_invoices: 2, unpaid_amount_ht: 30, plan: 'essentiel', online_bookings_blocked: true } };
    const open = { kind: 'commission_billing_suspended', metrics: { unpaid_invoices: 1, unpaid_amount_ht: 12.5, plan: 'croissance', online_bookings_blocked: false } };
    expect(alertLabel(blocked)).toBe('Commissions impayées : réservations en ligne coupées');
    expect(alertLabel(open)).toBe('Commissions impayées');
    expect(alertDetail(blocked)).toMatch(/2 facture\(s\) impayée\(s\), 30,00\s€ HT · réservations en ligne coupées/);
    expect(alertDetail(open)).toMatch(/formule Croissance, réservations en ligne ouvertes/);
  });

  it('litige perdu : « refacturé » seulement si la base l’indique', () => {
    expect(alertLabel({ kind: 'dispute_lost', metrics: { lost_disputes_30d: 1, amount_cents: 4590 } })).toBe('Litige perdu');
    expect(alertLabel({ kind: 'dispute_lost', metrics: null })).toBe('Litige perdu');
    expect(alertLabel({ kind: 'dispute_lost', metrics: { lost_disputes_30d: 1, has_recharge: false } })).toBe('Litige perdu');
    expect(alertLabel({ kind: 'dispute_lost', metrics: { lost_disputes_30d: 1, has_recharge: true } })).toBe('Litige perdu : refacturé');
  });

  it('détails chiffrés (montants en centimes pour les litiges)', () => {
    expect(alertDetail({ kind: 'dispute_lost', metrics: { lost_disputes_30d: 1, amount_cents: 4590, fee_cents: 1500 } }))
      .toMatch(/^1 litige\(s\) perdu\(s\) en 30 jours, 45,90\s€ \+ 15,00\s€ de frais$/);
    expect(alertDetail({ kind: 'dispute_other_open', metrics: { open_disputes: 1, amount_cents: 1000, sources: ['invoice'] } }))
      .toMatch(/\(facture\)$/);
    expect(alertDetail({ kind: 'recharge_recovery_failed', severity: 'critical', metrics: { recoveries: 1, missing_cents: 90, errors: ['insufficient_funds'] } }))
      .toMatch(/0,90\s€ non repris · erreurs Stripe : insufficient_funds · abandonnée après 5 essais$/);
    expect(alertDetail({ kind: 'ontime_threshold_reached', metrics: { failures_30d: 3, served_30d: 20, rate_30d: 0.15, sanctions_enabled: false } }))
      .toMatch(/^3 manquement\(s\) sur 20 servie\(s\) en 30 jours \(15\s%\) · sanctions éteintes/);
    expect(alertDetail({ kind: 'ontime_contest_pending', metrics: { contested_reports: 2, oldest_days: 8 } }))
      .toBe('2 contestation(s), la plus ancienne depuis 8 jour(s)');
    expect(alertDetail({ kind: 'subscription_unpaid', metrics: { plan: 'essentiel', status: 'unpaid' } }))
      .toBe('Nouvelles tentatives épuisées · formule actuelle Essentiel');
    expect(alertDetail({ kind: 'ontime_withdrawn', metrics: {} })).toBeNull();
  });

  it('chiffres absents ou de mauvais type : pas de détail, pas d erreur', () => {
    for (const kind of kinds) expect(() => alertDetail({ kind, metrics: { open_disputes: 'x', sources: 'y' } })).not.toThrow();
  });
});
