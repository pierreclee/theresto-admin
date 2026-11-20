/**
 * @jest-environment node
 *
 * Litiges, refacturations, reprises et commissions d'incidents (chantier C) : lecture après
 * requireAdmin(), colonnes sans donnée de client, consultation journalisée et refusée si le
 * journal échoue (D2).
 */
const logInsert = jest.fn();
const selects: Record<string, string[]> = {};
const tables: Record<string, { data: unknown; error: unknown }> = {};

/**
 * Requête simulée qui applique ses filtres et sa limite comme PostgREST (dans l'ordre des données,
 * déjà triées par le test) : un filtre fait après coup dans l'action se verrait.
 */
function query(table: string) {
  type R = Record<string, unknown>;
  const filters: ((r: R) => boolean)[] = [];
  let limit = Infinity;
  const result = () => {
    const t = tables[table] ?? { data: [], error: null };
    if (!Array.isArray(t.data)) return t;
    return { ...t, data: (t.data as R[]).filter((r) => filters.every((f) => f(r))).slice(0, limit) };
  };
  const q: Record<string, unknown> = {};
  q.order = () => q;
  q.limit = (n: number) => { limit = n; return q; };
  q.eq = (col: string, v: unknown) => { filters.push((r) => r[col] === v); return q; };
  q.in = (col: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[col])); return q; };
  q.gt = (col: string, v: number) => { filters.push((r) => Number(r[col]) > v); return q; };
  q.not = (col: string, op: string, v: unknown) => {
    if (op !== 'is' || v !== null) throw new Error(`filtre non simulé : not.${op}`);
    filters.push((r) => r[col] !== null && r[col] !== undefined);
    return q;
  };
  q.select = (cols: string) => { (selects[table] ??= []).push(cols); return q; };
  q.maybeSingle = async () => result();
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return q;
}

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' }),
  createClient: jest.fn(),
  getServerEnvironment: jest.fn(async () => 'staging'),
  getAdminClient: jest.fn(async () => ({
    from: (table: string) => (table === 'platform_logs' ? { insert: logInsert } : query(table)),
  })),
}));

import {
  getRestaurantRechargesAction,
  listDisputesAction,
  listIncidentCommissionRefundsAction,
} from '@/lib/actions/disputes';
import { ADMIN_LOG_FAILED_MESSAGE } from '@/lib/audit/messages';

const RID = '11111111-2222-4333-8444-555555555555';
const logged = () => logInsert.mock.calls.map(([row]) => row);

beforeEach(() => {
  logInsert.mockReset();
  logInsert.mockResolvedValue({ error: null });
  for (const k of Object.keys(selects)) delete selects[k];
  for (const k of Object.keys(tables)) delete tables[k];
});

describe('listDisputesAction', () => {
  it('litiges des deux tables, restaurant nommé, journalisés sans détail', async () => {
    tables.booking_disputes = { data: [{ stripe_dispute_id: 'du_1', restaurant_id: RID, payment_kind: 'main', amount_cents: 4590, fee_cents: 1500, currency: 'eur', status: 'needs_response', opened_at: '2026-11-20T10:00:00Z', evidence_due_by: '2026-11-30T10:00:00Z', livemode: false }], error: null };
    tables.platform_disputes = { data: [{ stripe_dispute_id: 'dp_2', restaurant_id: null, source: 'invoice', amount_cents: 2900, currency: 'eur', status: 'under_review', opened_at: '2026-11-19T10:00:00Z', livemode: false }], error: null };
    tables.restaurants = { data: [{ id: RID, name: 'Chez Paul' }], error: null };
    const result = await listDisputesAction('open');
    expect(result).toMatchObject({ ok: true, data: { disputes: [
      { stripeDisputeId: 'du_1', scope: 'booking', restaurantName: 'Chez Paul' },
      { stripeDisputeId: 'dp_2', scope: 'platform', restaurantId: null },
    ] } });
    expect(logged()).toEqual([expect.objectContaining({ action: 'view_disputes', target_type: 'restaurant', target_id: null, details: { filter: 'open', count: 2 } })]);
    for (const cols of [...selects.booking_disputes, ...selects.platform_disputes]) {
      expect(cols).not.toMatch(/booking_id|payment_intent|charge/);
    }
  });

  it('journal impossible : consultation refusée', async () => {
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(listDisputesAction('all')).resolves.toEqual({ ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE });
  });
});

describe('getRestaurantRechargesAction', () => {
  it('id invalide : rien lu, rien journalisé', async () => {
    await expect(getRestaurantRechargesAction('x')).resolves.toMatchObject({ ok: false, code: 'not-found' });
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('refacturations, reprises et factures de rattachement', async () => {
    tables.restaurants = { data: { id: RID, name: 'Chez Paul' }, error: null };
    tables.restaurant_recharges = { data: [{ id: 'r1', restaurant_id: RID, kind: 'dispute_lost', amount_ht: '45.90', period: '2026-11-01', occurred_at: '2026-11-20T10:00:00Z', invoice_id: 'inv1' }], error: null };
    tables.commission_recharge_recoveries = { data: [{ invoice_id: 'inv1', restaurant_id: RID, due_cents: 4590, recovered_cents: 0, credited_cents: 0, status: 'failed', attempts: 5, last_error: 'insufficient_funds', created_at: '2026-11-21T00:00:00Z' }], error: null };
    tables.commission_invoices = { data: [{ id: 'inv1', status: 'uncollectible', period: '2026-11-01', stripe_invoice_id: 'in_1' }], error: null };
    const result = await getRestaurantRechargesAction(RID);
    expect(result).toMatchObject({ ok: true, data: {
      livemode: false,
      recharges: [{ amountHt: 45.9, invoiceStatus: 'uncollectible' }],
      recoveries: [{ status: 'failed', stripeInvoiceId: 'in_1', lastError: 'insufficient_funds' }],
    } });
    expect(logged()).toEqual([expect.objectContaining({ action: 'view_restaurant_recharges', target_id: RID })]);
    expect(selects.restaurant_recharges[0]).not.toMatch(/booking_id|stripe_object_id/);
    expect(result).toMatchObject({ data: { truncated: { recharges: false, recoveries: false, disputes: false } } });
  });

  it('listes à leur limite : signalées tronquées', async () => {
    tables.restaurants = { data: { id: RID, name: 'Chez Paul' }, error: null };
    tables.restaurant_recharges = {
      data: Array.from({ length: 250 }, (_, i) => ({ id: `r${i}`, restaurant_id: RID, kind: 'service_fee', amount_ht: '0.90', period: '2026-11-01', occurred_at: '2026-11-20T10:00:00Z', invoice_id: null })),
      error: null,
    };
    tables.booking_disputes = {
      data: Array.from({ length: 100 }, (_, i) => ({ stripe_dispute_id: `du_${i}`, restaurant_id: RID, payment_kind: 'main', amount_cents: 100, status: 'lost', opened_at: '2026-11-20T10:00:00Z' })),
      error: null,
    };
    const result = await getRestaurantRechargesAction(RID);
    expect(result).toMatchObject({ ok: true, data: { truncated: { recharges: true, recoveries: false, disputes: true } } });
    expect((result as { data: { recharges: unknown[] } }).data.recharges).toHaveLength(200);
  });

  it('journal impossible : consultation refusée', async () => {
    tables.restaurants = { data: { id: RID, name: 'Chez Paul' }, error: null };
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(getRestaurantRechargesAction(RID)).resolves.toEqual({ ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE });
  });
});

describe('listIncidentCommissionRefundsAction', () => {
  it('seulement la commission non rendue, abandonnées d’abord, sans client ni description', async () => {
    tables.incidents = { data: [
      { id: 'i1', restaurant_id: RID, type: 'late', refund_commission_due_cents: 150, refund_commission_cents: 150, refund_commission_attempts: 0 },
      { id: 'i2', restaurant_id: RID, type: 'late', refund_commission_due_cents: 150, refund_commission_cents: 0, refund_commission_attempts: 2, refund_commission_failed_at: '2026-11-20T10:00:00Z', refund_commission_next_at: '2026-11-20T12:00:00Z' },
      { id: 'i3', restaurant_id: RID, type: 'other', refund_commission_due_cents: 90, refund_commission_cents: 0, refund_commission_attempts: 6, refund_commission_failed_at: '2026-11-19T10:00:00Z', refund_commission_next_at: null, refund_application_fee_id: 'fee_1' },
    ], error: null };
    tables.restaurants = { data: [{ id: RID, name: 'Chez Paul' }], error: null };
    const result = await listIncidentCommissionRefundsAction();
    expect(result).toMatchObject({ ok: true, data: { incidents: [
      { incidentId: 'i3', state: 'abandoned', applicationFeeId: 'fee_1' },
      { incidentId: 'i2', state: 'retrying', attempts: 2 },
    ] } });
    expect((result as { data: { incidents: unknown[] } }).data.incidents).toHaveLength(2);
    expect(selects.incidents[0]).not.toMatch(/customer_id|description|resolution_note/);
    expect(logged()).toEqual([expect.objectContaining({ action: 'view_incident_commission_refunds', details: { count: 2, abandoned: 1 } })]);
    expect((result as { data: { truncated: boolean } }).data.truncated).toBe(false);
  });

  it('incident abandonné ancien : trouvé derrière 500 incidents récents déjà réglés (filtre dans la requête)', async () => {
    const settled = Array.from({ length: 600 }, (_, i) => ({
      id: `s${i}`, restaurant_id: RID, type: 'late', refund_commission_due_cents: 150, refund_commission_cents: 150,
      refund_commission_attempts: 0, refund_commission_failed_at: null, refund_commission_next_at: null,
    }));
    const old = {
      id: 'old', restaurant_id: RID, type: 'late', refund_commission_due_cents: 150, refund_commission_cents: 0,
      refund_commission_attempts: 6, refund_commission_failed_at: '2026-01-10T10:00:00Z', refund_commission_next_at: null,
    };
    tables.incidents = { data: [...settled, old], error: null };
    tables.restaurants = { data: [{ id: RID, name: 'Chez Paul' }], error: null };
    const result = await listIncidentCommissionRefundsAction();
    expect(result).toMatchObject({ ok: true, data: { truncated: false, incidents: [{ incidentId: 'old', state: 'abandoned' }] } });
  });

  it('500 incidents à rendre : liste signalée tronquée', async () => {
    tables.incidents = {
      data: Array.from({ length: 520 }, (_, i) => ({
        id: `i${i}`, restaurant_id: RID, type: 'late', refund_commission_due_cents: 150, refund_commission_cents: 0,
        refund_commission_attempts: 1, refund_commission_failed_at: '2026-11-20T10:00:00Z', refund_commission_next_at: '2026-11-20T12:00:00Z',
      })),
      error: null,
    };
    tables.restaurants = { data: [{ id: RID, name: 'Chez Paul' }], error: null };
    const result = await listIncidentCommissionRefundsAction();
    expect(result).toMatchObject({ ok: true, data: { truncated: true } });
    expect((result as { data: { incidents: unknown[] } }).data.incidents).toHaveLength(500);
  });

  it('journal impossible : consultation refusée', async () => {
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(listIncidentCommissionRefundsAction()).resolves.toEqual({ ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE });
  });
});
