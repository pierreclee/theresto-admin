const update = jest.fn();
const insert = jest.fn();
const single = jest.fn();
const getSession = jest.fn();

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' }),
  createClient: jest.fn(async () => ({ auth: { getSession } })),
  getAdminClient: jest.fn(async () => ({
    from: (table: string) =>
      table === 'platform_logs'
        ? { insert }
        : {
            select: () => ({ eq: () => ({ single }) }),
            update: (values: unknown) => ({ eq: (...args: unknown[]) => update(values, ...args) }),
          },
  })),
}));

import { updateSubscriptionPlanAction } from '@/lib/actions/admin';

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
}
const now = () => Math.floor(Date.now() / 1000);
const withToken = (claims: Record<string, unknown>) =>
  getSession.mockResolvedValue({ data: { session: { access_token: jwt(claims) } } });

describe('updateSubscriptionPlanAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    single.mockResolvedValue({ data: { subscription_plan: 'croissance' }, error: null });
    update.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });
  });

  it('refuse sans TOTP récent et n écrit rien', async () => {
    withToken({ aal: 'aal1', amr: [{ method: 'password', timestamp: now() }] });
    await expect(updateSubscriptionPlanAction('r1', 'liberte')).resolves.toMatchObject({
      success: false,
      code: 'mfa-required',
      error: expect.stringMatching(/deux étapes/),
    });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuse un TOTP vieux de plus de 5 min', async () => {
    withToken({ aal: 'aal2', amr: [{ method: 'totp', timestamp: now() - 301 }] });
    await expect(updateSubscriptionPlanAction('r1', 'liberte')).resolves.toMatchObject({
      success: false,
      code: 'mfa-required',
      error: expect.stringMatching(/deux étapes/),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuse un plan inconnu', async () => {
    withToken({ aal: 'aal2', amr: [{ method: 'totp', timestamp: now() }] });
    await expect(updateSubscriptionPlanAction('r1', 'gold' as never)).rejects.toThrow(/Plan invalide/);
    expect(update).not.toHaveBeenCalled();
  });

  it('change le plan et journalise ancien/nouveau plan avec un TOTP récent', async () => {
    withToken({ aal: 'aal2', amr: [{ method: 'totp', timestamp: now() - 10 }] });
    await expect(updateSubscriptionPlanAction('r1', 'liberte')).resolves.toEqual({ success: true, auditLogged: true });
    expect(update).toHaveBeenCalledWith({ subscription_plan: 'liberte' }, 'id', 'r1');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscription_plan_changed',
        target_type: 'restaurant',
        target_id: 'r1',
        performed_by: 'admin-1',
        performed_by_email: 'admin@theresto.fr',
        details: { oldPlan: 'croissance', newPlan: 'liberte' },
      }),
    );
  });

  it('signale auditLogged=false si la journalisation échoue', async () => {
    withToken({ aal: 'aal2', amr: [{ method: 'totp', timestamp: now() }] });
    insert.mockResolvedValue({ error: { message: 'boom' } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(updateSubscriptionPlanAction('r1', 'liberte')).resolves.toEqual({ success: true, auditLogged: false });
  });
});
