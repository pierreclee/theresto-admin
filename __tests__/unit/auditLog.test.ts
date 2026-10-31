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
import {
  AUDIT_ACTION_LABELS, AUDIT_ACTION_OPTIONS, AUDIT_RESOURCE_LABELS, AUDIT_RESOURCE_OPTIONS,
  PLATFORM_LOG_COLUMNS, formatAuditDetails, parisDayStart, toAuditLog,
} from '@/lib/utils/auditLog';

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

  it('parisDayStart : minuit à Paris, heure d hiver et d été', () => {
    expect(parisDayStart('2026-11-03')?.toISOString()).toBe('2026-11-02T23:00:00.000Z');
    expect(parisDayStart('2026-07-14')?.toISOString()).toBe('2026-07-13T22:00:00.000Z');
    // Jours de changement d'heure : minuit est encore à l'ancienne heure
    expect(parisDayStart('2026-03-29')?.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(parisDayStart('2026-10-25')?.toISOString()).toBe('2026-10-24T22:00:00.000Z');
  });

  it('parisDayStart : jour suivant, et null si la date est invalide', () => {
    expect(parisDayStart('2026-11-03', 1)?.toISOString()).toBe('2026-11-03T23:00:00.000Z');
    expect(parisDayStart('2026-12-31', 1)?.toISOString()).toBe('2026-12-31T23:00:00.000Z');
    expect(parisDayStart('2026-10-24', 1)?.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(parisDayStart('03/11/2026')).toBeNull();
    expect(parisDayStart('2026-02-30')).toBeNull();
    expect(parisDayStart('')).toBeNull();
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

  it('lit platform_logs avec dates (jours de Paris), page et tri', async () => {
    await getAuditLogsAction({
      startDate: '2026-11-01', endDate: '2026-11-03',
      limit: 50, offset: 100, resourceType: 'user', adminId: 'admin-1',
    });
    expect(from).toHaveBeenCalledWith('platform_logs');
    expect(calls).toEqual(expect.arrayContaining([
      ['select', [PLATFORM_LOG_COLUMNS, { count: 'exact' }]],
      ['eq', ['target_type', 'user']],
      ['eq', ['performed_by', 'admin-1']],
      ['gte', ['created_at', '2026-10-31T23:00:00.000Z']],
      ['lt', ['created_at', '2026-11-03T23:00:00.000Z']],
      ['order', ['created_at', { ascending: false }]],
      ['range', [100, 149]],
    ]));
  });

  it('borne la page (200 lignes au plus) et convertit les lignes', async () => {
    result.data = [row];
    result.count = 1;
    const out = await getAuditLogsAction({ limit: 10_000, offset: -5 });
    expect(calls).toEqual(expect.arrayContaining([['range', [0, 199]]]));
    expect(out).toEqual({ ok: true, data: { logs: [toAuditLog(row)], total: 1 } });
  });

  it('erreur de lecture : résultat { ok: false, error } au lieu d une exception (masquée en production)', async () => {
    result.error = { message: 'relation indisponible' };
    await expect(getAuditLogsAction({})).resolves.toEqual({ ok: false, error: 'relation indisponible' });
  });

  it('page et dates non numériques ou invalides : valeurs par défaut, aucun filtre', async () => {
    await getAuditLogsAction({ limit: Number.NaN, offset: 'abc' as never, startDate: 'n importe quoi', endDate: '' });
    expect(calls).toEqual(expect.arrayContaining([['range', [0, 49]]]));
    expect(calls.some(([m]) => m === 'gte' || m === 'lt')).toBe(false);
  });

  it('offset et limit non entiers arrondis', async () => {
    await getAuditLogsAction({ limit: 10.7, offset: 20.2 });
    expect(calls).toEqual(expect.arrayContaining([['range', [20, 29]]]));
  });
});

describe('Monitoring : libellés, filtres et détails', () => {
  // Actions écrites par les Edge Functions de theresto_app (lot 9, commits 41092456 et b18dcc69).
  const EDGE_ACTIONS = [
    'create_restaurant_invitation', 'approve_restaurant', 'reject_restaurant',
    'list_privatization_incidents', 'view_restaurant_billing', 'resolve_privatization_incident',
  ];

  it('chaque action des Edge Functions a un libellé et figure dans le filtre', () => {
    for (const action of EDGE_ACTIONS) {
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
      expect(AUDIT_ACTION_OPTIONS.map((o) => o.value)).toContain(action);
    }
    expect(AUDIT_ACTION_LABELS.view_restaurant_billing).toBe('Facturation du restaurant consultée');
  });

  it('les cibles des Edge Functions ont un libellé et figurent dans le filtre', () => {
    for (const type of ['onboarding_invitation', 'restaurant', 'privatization_incident']) {
      expect(AUDIT_RESOURCE_LABELS[type]).toBeTruthy();
      expect(AUDIT_RESOURCE_OPTIONS.map((o) => o.value)).toContain(type);
    }
  });

  it('détails des Edge Functions affichés', () => {
    expect(formatAuditDetails({ hasAccount: false })).toBe('Compte existant : non');
    expect(formatAuditDetails({ correctionMode: 'correction_required', sectionsToFix: 2, hasReason: true }))
      .toBe('Mode : correction_required · Sections à corriger : 2 · Motif saisi : oui');
    expect(formatAuditDetails({ status: 'open', count: 3 })).toBe('Statut : open · Lignes : 3');
    expect(formatAuditDetails({ hasStripeCustomer: true })).toBe('Client Stripe : oui');
    expect(formatAuditDetails({ status: 'resolved', hasNote: true })).toBe('Statut : resolved · Note saisie : oui');
    expect(formatAuditDetails({ amountCents: 12345 })).toMatch(/^Montant : 123,45\s€$/);
  });

  it('aucun texte libre : clés inconnues, erreurs, e-mails et chaînes non codées ignorés', () => {
    expect(formatAuditDetails({
      error: 'No such customer: jean@dupont.fr', lastError: 'x', resolution: 'Appelé Jean Dupont',
      adminEmail: 'admin@theresto.fr', search: 'Dupont',
    })).toBe('');
    expect(formatAuditDetails({ status: 'Jean Dupont a appelé', correctionMode: 'a@b.fr' })).toBe('');
    expect(formatAuditDetails({ fields: ['name', 'phone_number', 'jean@dupont.fr'] })).toBe('Champs : name, phone_number');
    expect(formatAuditDetails(undefined)).toBe('');
    expect(formatAuditDetails({ count: Number.NaN, hasNote: 'oui' })).toBe('');
  });
});

describe('getAuditLogsAction : filtres action et type', () => {
  beforeEach(() => { calls.length = 0; });

  it('filtre par action et par type', async () => {
    await getAuditLogsAction({ action: 'view_restaurant_billing', resourceType: 'restaurant' });
    expect(calls).toEqual(expect.arrayContaining([
      ['eq', ['action', 'view_restaurant_billing']],
      ['eq', ['target_type', 'restaurant']],
    ]));
  });

  it('filtres non textuels ignorés', async () => {
    await getAuditLogsAction({ action: 42 as never, resourceType: {} as never });
    expect(calls.some(([m]) => m === 'eq')).toBe(false);
  });
});
