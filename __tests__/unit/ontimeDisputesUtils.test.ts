import { countLabel, formatCents, stripeDashboardUrl } from '@/lib/utils/disputes';
import {
  bookingFactsSummary,
  formatRemaining,
  isSanctionActive,
  lastPageOffset,
  ontimeStatusLabel,
  reasonError,
  samePagedList,
} from '@/lib/utils/ontime';
import type { OntimeSanction } from '@/lib/types/ontime';

describe('liens Stripe', () => {
  it.each([
    ['du_123', false, 'https://dashboard.stripe.com/test/disputes/du_123'],
    ['dp_123', true, 'https://dashboard.stripe.com/disputes/dp_123'],
    ['fee_1Ab', false, 'https://dashboard.stripe.com/test/connect/application_fees/fee_1Ab'],
    ['re_9', true, 'https://dashboard.stripe.com/refunds/re_9'],
    ['in_7', false, 'https://dashboard.stripe.com/test/invoices/in_7'],
  ])('%s', (id, live, url) => {
    expect(stripeDashboardUrl(id, live)).toBe(url);
  });

  it.each([null, '', 'pi_1', 'du_1/../x', 'javascript:alert(1)'])('id refusé : %p', (id) => {
    expect(stripeDashboardUrl(id, false)).toBeNull();
  });

  it('centimes', () => {
    expect(formatCents(4590)).toMatch(/^45,90\s€$/);
    expect(formatCents(null)).toBe('—');
  });
});

describe('OnTime', () => {
  it('motif : 10 à 1 000 caractères hors espaces de bord', () => {
    expect(reasonError('   123456789  ')).toMatch(/trop court/);
    expect(reasonError('1234567890')).toBeNull();
    expect(reasonError('x'.repeat(1001))).toMatch(/trop long/);
  });

  it('statut inconnu : libellé générique', () => {
    expect(ontimeStatusLabel('contested')).toBe('Contesté, à trancher');
    expect(ontimeStatusLabel('zzz')).toBe('Statut inconnu');
  });

  it('sanctions en vigueur', () => {
    const base = { starts_at: '2026-01-01T00:00:00Z', lifted_at: null, ends_at: null } as unknown as OntimeSanction;
    const t = Date.parse('2026-01-05T00:00:00Z');
    expect(isSanctionActive({ ...base, kind: 'withdrawal' }, t)).toBe(true);
    expect(isSanctionActive({ ...base, kind: 'suspension', ends_at: '2026-01-15T00:00:00Z' }, t)).toBe(true);
    expect(isSanctionActive({ ...base, kind: 'suspension', ends_at: '2026-01-02T00:00:00Z' }, t)).toBe(false);
    expect(isSanctionActive({ ...base, kind: 'withdrawal', lifted_at: '2026-01-03T00:00:00Z' }, t)).toBe(false);
    expect(isSanctionActive({ ...base, kind: 'warning' }, t)).toBe(false);
  });

  it('faits et durées', () => {
    expect(bookingFactsSummary({ booking_facts: null })).toMatch(/supprimée/);
    expect(bookingFactsSummary({ booking_facts: { status: 'completed', arrived: false, auto_honored: true } }))
      .toBe('Terminée · arrivée non enregistrée · réputée honorée à la fin du service');
    expect(formatRemaining(0)).toBe('échue');
    expect(formatRemaining(26 * 3600)).toBe('1 j 2 h');
    expect(formatRemaining(90)).toBe('1 min');
  });
});

describe('listes et pagination', () => {
  it('nombre d’une liste tronquée', () => {
    expect(countLabel(12, false)).toBe('(12)');
    expect(countLabel(200, true)).toBe('(200 premières)');
  });

  it.each([
    [120, 100, 100],
    [100, 100, 50],
    [51, 100, 50],
    [50, 50, 0],
    [0, 50, 0],
    [0, 0, 0],
    [10, 0, 0],
  ])('total %p, offset %p → %p', (total, offset, expected) => {
    expect(lastPageOffset(total, offset, 50)).toBe(expected);
  });

  it('données précédentes gardées seulement pour une autre page de la même liste', () => {
    const key = ['ontime', 'reports', 'contested', null, 50];
    expect(samePagedList(key, 'contested', null)).toBe(true);
    expect(samePagedList(key, 'all', null)).toBe(false);
    expect(samePagedList(key, 'contested', '11111111-2222-4333-8444-555555555555')).toBe(false);
  });
});
