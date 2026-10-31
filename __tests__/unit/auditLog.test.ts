/**
 * @jest-environment node
 */
const calls: [string, unknown[]][] = [];
const result: { data: unknown[]; count: number; error: { message: string } | null } = { data: [], count: 0, error: null };
function recorder(): unknown {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'lt', 'order', 'range']) {
    q[m] = (...args: unknown[]) => { calls.push([m, args]); return q; };
  }
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}
const from = jest.fn<unknown, [string]>(() => recorder());
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' }),
  createClient: jest.fn(),
  getAdminClient: jest.fn(async () => ({ from })),
}));

import { getAuditLogsAction } from '@/lib/actions/admin';
import { dayAfter, PLATFORM_LOG_COLUMNS, toAuditLog } from '@/lib/utils/auditLog';

const row = {
  id: 'l1', action: 'retry_privatization_refund', performed_by: 'admin-1',
  performed_by_email: 'admin@theresto.fr', target_type: 'privatization_incident', target_id: 'i1',
  details: { amountCents: 100 }, created_at: '2026-11-03T10:00:00.000Z',
};

describe('toAuditLog', () => {
  it('convertit une ligne de platform_logs', () => {
    expect(toAuditLog(row)).toEqual({
      id: 'l1', adminId: 'admin-1', adminEmail: 'admin@theresto.fr', action: 'retry_privatization_refund',
      resourceType: 'privatization_incident', resourceId: 'i1', changes: { amountCents: 100 },
      timestamp: new Date('2026-11-03T10:00:00.000Z'), success: true,
    });
  });

  it('une action *_failed est un échec', () => {
    expect(toAuditLog({ ...row, action: 'retry_privatization_refund_failed' }).success).toBe(false);
  });

  it('ligne écrite sans admin (tâche planifiée)', () => {
    expect(toAuditLog({ ...row, performed_by: null, performed_by_email: null, target_type: null, details: null }))
      .toMatchObject({ adminId: '', adminEmail: undefined, resourceType: '', changes: undefined });
  });

  it('ne lit aucune colonne supprimée au lot 9', () => {
    expect(PLATFORM_LOG_COLUMNS).not.toMatch(/event_type|actor_id|ip_address/);
  });

  it('dayAfter : fin exclusive du filtre « au »', () => {
    expect(dayAfter(new Date('2026-11-03T00:00:00.000Z')).toISOString()).toBe('2026-11-04T00:00:00.000Z');
  });
});

describe('getAuditLogsAction', () => {
  beforeEach(() => {
    calls.length = 0;
    from.mockClear();
    result.data = [];
    result.count = 0;
    result.error = null;
  });

  it('lit platform_logs avec dates, page et tri', async () => {
    await getAuditLogsAction({
      startDate: new Date('2026-11-01T00:00:00.000Z'), endDate: new Date('2026-11-03T00:00:00.000Z'),
      limit: 50, offset: 100, resourceType: 'user', adminId: 'admin-1',
    });
    expect(from).toHaveBeenCalledWith('platform_logs');
    expect(calls).toEqual(expect.arrayContaining([
      ['select', [PLATFORM_LOG_COLUMNS, { count: 'exact' }]],
      ['eq', ['target_type', 'user']],
      ['eq', ['performed_by', 'admin-1']],
      ['gte', ['created_at', '2026-11-01T00:00:00.000Z']],
      ['lt', ['created_at', '2026-11-04T00:00:00.000Z']],
      ['order', ['created_at', { ascending: false }]],
      ['range', [100, 149]],
    ]));
  });

  it('borne la page (200 lignes au plus) et convertit les lignes', async () => {
    result.data = [row];
    result.count = 1;
    const out = await getAuditLogsAction({ limit: 10_000, offset: -5 });
    expect(calls).toEqual(expect.arrayContaining([['range', [0, 199]]]));
    expect(out).toEqual({ logs: [toAuditLog(row)], total: 1 });
  });
});
