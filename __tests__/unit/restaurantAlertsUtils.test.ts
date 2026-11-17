import {
  alertDetail,
  alertKindLabel,
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
