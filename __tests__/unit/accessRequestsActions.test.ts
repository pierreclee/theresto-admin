/**
 * @jest-environment node
 *
 * Demandes d'ouverture d'un espace restaurant (docs/features/onboarding-accompagne.md de l'app) :
 * RPC de la clé service après requireAdmin(), consultation journalisée et refusée si le journal
 * échoue (D2), refus journalisé avec identifiant et statut seulement, refus de la base traduits.
 */
const logInsert = jest.fn();
const rpc = jest.fn();
const requireAdmin = jest.fn();

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: () => requireAdmin(),
  createClient: jest.fn(),
  getAdminClient: jest.fn(async () => ({
    rpc: (name: string, args: unknown) => rpc(name, args),
    from: (table: string) => {
      if (table !== 'platform_logs') throw new Error(`table inattendue : ${table}`);
      return { insert: logInsert };
    },
  })),
}));

import {
  declineRestaurantAccessRequestAction,
  listRestaurantAccessRequestsAction,
} from '@/lib/actions/accessRequests';
import { ADMIN_LOG_FAILED_MESSAGE } from '@/lib/audit/messages';

const ID = '11111111-2222-4333-8444-555555555555';
const ROW = {
  id: ID, user_id: 'u1', restaurant_name: 'Chez Paul', city: 'Lyon', phone: '+33612345678',
  message: 'Rappelez-moi le matin', status: 'pending', created_at: '2026-12-06T10:00:00Z', handled_at: null,
  email: 'paul@exemple.fr',
};
const PERSONAL = ['Chez Paul', 'Lyon', '+33612345678', 'Rappelez-moi', 'paul@exemple.fr'];
const logged = () => logInsert.mock.calls.map(([row]) => row);

beforeEach(() => {
  jest.clearAllMocks();
  requireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' });
  logInsert.mockResolvedValue({ error: null });
});

describe('listRestaurantAccessRequestsAction', () => {
  it('« pending » par défaut, borne 500, lignes converties, consultation journalisée sans donnée personnelle', async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null });
    const result = await listRestaurantAccessRequestsAction();
    expect(rpc).toHaveBeenCalledWith('admin_restaurant_access_requests', { p_status: 'pending', p_limit: 500 });
    expect(result).toEqual({
      ok: true,
      data: {
        truncated: false,
        requests: [{
          id: ID, userId: 'u1', restaurantName: 'Chez Paul', city: 'Lyon', phone: '+33612345678',
          message: 'Rappelez-moi le matin', status: 'pending', createdAt: '2026-12-06T10:00:00Z', handledAt: null,
          email: 'paul@exemple.fr',
        }],
      },
    });
    expect(logged()).toEqual([expect.objectContaining({
      action: 'list_restaurant_access_requests', target_type: 'access_request', target_id: null,
      performed_by: 'admin-1', details: { status: 'pending', count: 1 },
    })]);
    for (const value of PERSONAL) expect(JSON.stringify(logged())).not.toContain(value);
  });

  it('« all » : statut NULL envoyé à la RPC', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(listRestaurantAccessRequestsAction('all')).resolves.toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith('admin_restaurant_access_requests', { p_status: null, p_limit: 500 });
  });

  it('500 lignes : liste signalée comme tronquée', async () => {
    rpc.mockResolvedValue({ data: Array.from({ length: 500 }, () => ROW), error: null });
    await expect(listRestaurantAccessRequestsAction('invited')).resolves.toMatchObject({ ok: true, data: { truncated: true } });
  });

  it('filtre inconnu : refusé avant la base, rien journalisé', async () => {
    await expect(listRestaurantAccessRequestsAction('archived')).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(rpc).not.toHaveBeenCalled();
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('journal en échec : consultation refusée (adminLogRefusal), aucune ligne renvoyée', async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null });
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(listRestaurantAccessRequestsAction()).resolves.toEqual({
      ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE,
    });
  });

  it('erreur de la base : message générique, rien journalisé', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'function does not exist' } });
    const result = await listRestaurantAccessRequestsAction();
    expect(result).toEqual({ ok: false, code: '42883', error: 'Impossible de charger les demandes.' });
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('requireAdmin en échec : ni base ni journal', async () => {
    requireAdmin.mockRejectedValue(new Error('Accès refusé'));
    await expect(listRestaurantAccessRequestsAction()).rejects.toThrow('Accès refusé');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('declineRestaurantAccessRequestAction', () => {
  it('passe la demande à declined et journalise identifiant et statut', async () => {
    rpc.mockResolvedValue({ data: { id: ID, status: 'declined', handled_at: '2026-12-06T11:00:00Z' }, error: null });
    await expect(declineRestaurantAccessRequestAction(ID)).resolves.toEqual({
      ok: true, data: { id: ID, status: 'declined', handledAt: '2026-12-06T11:00:00Z', auditLogged: true },
    });
    expect(rpc).toHaveBeenCalledWith('admin_set_restaurant_access_request_status', { p_id: ID, p_status: 'declined' });
    expect(logged()).toEqual([expect.objectContaining({
      action: 'decline_restaurant_access_request', target_type: 'access_request', target_id: ID,
      details: { previousStatus: 'pending', status: 'declined' },
    })]);
  });

  it('journal en échec : demande refusée quand même (pas de retour en attente possible), auditLogged false', async () => {
    rpc.mockResolvedValue({ data: { id: ID, status: 'declined', handled_at: '2026-12-06T11:00:00Z' }, error: null });
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(declineRestaurantAccessRequestAction(ID)).resolves.toMatchObject({ ok: true, data: { auditLogged: false } });
  });

  it.each([
    [{ code: 'PT409', hint: 'P0A06' }, 'conflict', /déjà été traitée/],
    [{ code: 'PT404', hint: 'P0A07' }, 'not-found', /introuvable/],
    [{ code: '22023', hint: 'P0A08' }, 'invalid-argument', /invalide/],
    [{ code: 'PT409' }, 'conflict', /déjà été traitée/],
  ])('refus de la base %o traduit', async (error, code, message) => {
    rpc.mockResolvedValue({ data: null, error: { ...error, message: 'raw' } });
    const result = await declineRestaurantAccessRequestAction(ID);
    expect(result).toMatchObject({ ok: false, code });
    expect(!result.ok && result.error).toMatch(message);
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('identifiant mal formé : refusé avant la base', async () => {
    await expect(declineRestaurantAccessRequestAction('x')).resolves.toMatchObject({ ok: false, code: 'not-found' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
