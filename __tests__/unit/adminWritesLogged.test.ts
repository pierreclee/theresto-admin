/**
 * @jest-environment node
 *
 * RGPD-29 (lot 9 ; D2, D3) : chaque écriture de l'admin écrit une ligne de platform_logs
 * (identifiants, noms de champs, valeurs non personnelles) ; la modération enregistre son auteur.
 */
const insert = jest.fn();
const update = jest.fn();
const upsert = jest.fn();
const writeResult: { data: unknown; error: { message: string } | null } = { data: { id: 'x' }, error: null };
function chain(result: unknown): unknown {
  return new Proxy({}, {
    get: (_t, prop) => (prop === 'then'
      ? (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
      : () => chain(result)),
  });
}
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' }),
  createClient: jest.fn(),
  getAdminClient: jest.fn(async () => ({
    from: (table: string) => (table === 'platform_logs'
      ? { insert }
      : {
          update: (values: unknown) => { update(table, values); return chain(writeResult); },
          upsert: (values: unknown) => { upsert(table, values); return chain(writeResult); },
        }),
  })),
}));

import { moderateUserAction } from '@/lib/actions/users';
import { approveRestaurantAction, updateConfigAction, updateRestaurantAction } from '@/lib/actions/admin';

const logged = () => insert.mock.calls.map(([row]) => row);

describe('écritures journalisées', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    writeResult.data = { id: 'x' };
    writeResult.error = null;
  });

  it('modération : auteur écrit, statut journalisé, motif jamais recopié', async () => {
    await expect(moderateUserAction('u1', 'ban', 'Propos injurieux envers Jean Dupont'))
      .resolves.toEqual({ newStatus: 'banned', auditLogged: true });
    expect(update).toHaveBeenCalledWith('users', expect.objectContaining({ moderation_status: 'banned', moderated_by: 'admin-1' }));
    expect(logged()).toEqual([expect.objectContaining({
      action: 'moderate_user', target_type: 'user', target_id: 'u1', performed_by: 'admin-1',
      details: { newStatus: 'banned', hasReason: true },
    })]);
    expect(JSON.stringify(logged())).not.toContain('Dupont');
  });

  it('modération : journal en échec, auditLogged=false (écriture déjà faite)', async () => {
    insert.mockResolvedValue({ error: { code: '42501' } });
    await expect(moderateUserAction('u1', 'activate')).resolves.toEqual({ newStatus: 'active', auditLogged: false });
    expect(update).toHaveBeenCalled();
  });

  it('modération refusée par la base : rien de journalisé', async () => {
    writeResult.error = { message: 'refus' };
    await expect(moderateUserAction('u1', 'suspend', 'x')).rejects.toThrow('refus');
    expect(insert).not.toHaveBeenCalled();
  });

  it('suspension d un restaurant', async () => {
    await expect(approveRestaurantAction('r1', 'suspended')).resolves.toEqual({ ok: true, auditLogged: true });
    expect(logged()).toEqual([expect.objectContaining({ action: 'suspend_restaurant', target_type: 'restaurant', target_id: 'r1' })]);
  });

  it('suspension : journal en échec, auditLogged=false (écriture déjà faite)', async () => {
    insert.mockResolvedValue({ error: { code: '42501' } });
    await expect(approveRestaurantAction('r1', 'suspended')).resolves.toEqual({ ok: true, auditLogged: false });
    expect(update).toHaveBeenCalled();
  });

  it('modification d un restaurant : noms des champs seulement', async () => {
    await expect(updateRestaurantAction('r1', { name: 'Chez Paul', phone_number: '0600000000' } as never))
      .resolves.toEqual({ restaurant: { id: 'x' }, auditLogged: true });
    expect(logged()).toEqual([expect.objectContaining({
      action: 'update_restaurant', target_type: 'restaurant', target_id: 'r1', details: { fields: ['name', 'phone_number'] },
    })]);
    expect(JSON.stringify(logged())).not.toMatch(/Chez Paul|0600000000/);
  });

  it('modification d un restaurant : journal en échec, auditLogged=false', async () => {
    insert.mockResolvedValue({ error: { code: '42501' } });
    await expect(updateRestaurantAction('r1', { name: 'Chez Paul' } as never))
      .resolves.toEqual({ restaurant: { id: 'x' }, auditLogged: false });
  });

  it('configuration : journal en échec, auditLogged=false', async () => {
    insert.mockResolvedValue({ error: { code: '42501' } });
    await expect(updateConfigAction({ maintenanceMode: true } as never))
      .resolves.toMatchObject({ auditLogged: false });
  });

  it('configuration : valeurs non personnelles', async () => {
    await expect(updateConfigAction({ maintenanceMode: true } as never))
      .resolves.toMatchObject({ config: { currency: 'EUR' }, auditLogged: true });
    expect(upsert).toHaveBeenCalled();
    expect(logged()).toEqual([expect.objectContaining({
      action: 'update_platform_config', target_type: 'config', target_id: 'global', details: { maintenanceMode: true },
    })]);
  });
});
