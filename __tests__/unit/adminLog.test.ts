/**
 * @jest-environment node
 */
const insert = jest.fn();
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  getAdminClient: jest.fn(async () => ({ from: (table: string) => (table === 'platform_logs' ? { insert } : null) })),
}));

import { AdminLogError, logAdminAction, logAdminReadOrThrow } from '@/lib/audit/adminLog';

const admin = { id: 'admin-1', email: 'admin@theresto.fr' };

describe('logAdminAction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('écrit une ligne de platform_logs', async () => {
    insert.mockResolvedValue({ error: null });
    await expect(logAdminAction(admin, { action: 'view_user', targetType: 'user', targetId: 'u1' })).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith({
      action: 'view_user', target_type: 'user', target_id: 'u1',
      performed_by: 'admin-1', performed_by_email: 'admin@theresto.fr', details: {},
    });
  });

  it('n envoie ni created_at ni colonne supprimée par le lot 9', async () => {
    insert.mockResolvedValue({ error: null });
    await logAdminAction(admin, { action: 'list_users', targetType: 'user', details: { count: 2 } });
    const row = insert.mock.calls[0][0];
    expect(Object.keys(row).sort()).toEqual(
      ['action', 'details', 'performed_by', 'performed_by_email', 'target_id', 'target_type'],
    );
    expect(row.target_id).toBeNull();
  });

  it('renvoie false si l écriture échoue, sans exception', async () => {
    insert.mockResolvedValue({ error: { code: '42501', message: 'denied' } });
    await expect(logAdminAction(admin, { action: 'x', targetType: 'config' })).resolves.toBe(false);
  });

  it('renvoie false si le client lève, sans exception', async () => {
    insert.mockRejectedValue(new Error('réseau'));
    await expect(logAdminAction(admin, { action: 'x', targetType: 'config' })).resolves.toBe(false);
  });

  it('logAdminReadOrThrow refuse la lecture si le journal échoue (D2)', async () => {
    insert.mockResolvedValue({ error: { code: '42501', message: 'denied' } });
    await expect(logAdminReadOrThrow(admin, { action: 'view_user', targetType: 'user', targetId: 'u1' }))
      .rejects.toBeInstanceOf(AdminLogError);
  });

  it('logAdminReadOrThrow laisse passer si le journal est écrit', async () => {
    insert.mockResolvedValue({ error: null });
    await expect(logAdminReadOrThrow(admin, { action: 'view_user', targetType: 'user', targetId: 'u1' }))
      .resolves.toBeUndefined();
  });
});
