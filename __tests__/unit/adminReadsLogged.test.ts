/**
 * @jest-environment node
 *
 * RGPD-29 (lot 9 ; D1, D2, D3) : chaque consultation d'une fiche, d'une liste ou du Kbis
 * écrit une ligne de platform_logs, sans donnée personnelle ; si le journal échoue, la
 * consultation est refusée.
 */
const insert = jest.fn();
const createSignedUrl = jest.fn();
const tables: Record<string, unknown> = {};
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
    from: (table: string) => (table === 'platform_logs' ? { insert } : chain(tables[table])),
    storage: { from: () => ({ createSignedUrl }) },
  })),
}));

import { getCrmProfileAction, getUserAction, listUsersAction } from '@/lib/actions/users';
import { getKbisUrlAction, getRestaurantDetailAction, getRestaurantsAction } from '@/lib/actions/admin';

const logged = () => insert.mock.calls.map(([row]) => row);

describe('consultations journalisées', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null });
    Object.assign(tables, {
      users: { data: { id: 'u1', email: 'client@exemple.fr', name: 'Client', roles: ['customer'] }, error: null },
      user_stats: { data: null, error: null },
      bookings: { data: [], error: null },
      favorite_restaurants: { data: [], error: null },
      restaurants: { data: { id: 'r1', name: 'Chez Paul', kbis_path: 'r1/kbis.pdf' }, error: null, count: 1 },
    });
  });

  it.each([
    ['getCrmProfileAction', () => getCrmProfileAction('u1'), 'view_user_profile', 'user', 'u1'],
    ['getUserAction', () => getUserAction('u1'), 'view_user', 'user', 'u1'],
    ['getRestaurantDetailAction', () => getRestaurantDetailAction('r1'), 'view_restaurant', 'restaurant', 'r1'],
    ['getKbisUrlAction', () => getKbisUrlAction('r1'), 'view_kbis', 'kbis', 'r1'],
  ])('%s', async (_name, run, action, targetType, targetId) => {
    await run();
    expect(logged()).toEqual([expect.objectContaining({ action, target_type: targetType, target_id: targetId, performed_by: 'admin-1' })]);
    expect(JSON.stringify(logged())).not.toContain('client@exemple.fr');
  });

  it('utilisateur introuvable : rien de consulté, rien de journalisé', async () => {
    tables.users = { data: null, error: null };
    await expect(getUserAction('u404')).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('Kbis absent : rien de consulté, rien de journalisé', async () => {
    tables.restaurants = { data: { kbis_path: null }, error: null };
    await expect(getKbisUrlAction('r1')).resolves.toEqual({ ok: false, error: 'Aucun Kbis déposé' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('Kbis à l ancienne URL publique : journalisé aussi', async () => {
    tables.restaurants = { data: { kbis_path: 'https://ancien/kbis.pdf' }, error: null };
    await expect(getKbisUrlAction('r1')).resolves.toEqual({ ok: true, url: 'https://ancien/kbis.pdf' });
    expect(logged()).toEqual([expect.objectContaining({ action: 'view_kbis', target_id: 'r1' })]);
  });

  it('listes : filtres et nombre, jamais les personnes ni le texte cherché', async () => {
    tables.users = { data: [{ id: 'u1', email: 'client@exemple.fr' }], error: null };
    tables.restaurants = { data: [{ id: 'r1', name: 'Chez Paul' }], error: null, count: 1 };
    await listUsersAction({ statusFilter: 'banned' });
    await getRestaurantsAction({ status: 'approved', search: 'Chez' });
    expect(logged()).toEqual([
      expect.objectContaining({ action: 'list_users', target_type: 'user', target_id: null, details: { statusFilter: 'banned', offset: 0, count: 1 } }),
      expect.objectContaining({
        action: 'list_restaurants', target_type: 'restaurant', target_id: null,
        details: { status: 'approved', subscription: null, search: true, offset: 0, count: 1 },
      }),
    ]);
    expect(JSON.stringify(logged())).not.toMatch(/client@exemple\.fr|Chez/);
  });

  it('journal en échec : fiches et listes refusées, Kbis refusé sans lien signé (D2)', async () => {
    insert.mockResolvedValue({ error: { code: '42501' } });
    await expect(getCrmProfileAction('u1')).rejects.toThrow(/journal/);
    await expect(getUserAction('u1')).rejects.toThrow(/journal/);
    await expect(getRestaurantDetailAction('r1')).rejects.toThrow(/journal/);
    await expect(listUsersAction({})).rejects.toThrow(/journal/);
    await expect(getRestaurantsAction({})).rejects.toThrow(/journal/);
    await expect(getKbisUrlAction('r1')).resolves.toEqual({ ok: false, error: expect.stringMatching(/journal/) });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
