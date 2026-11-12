/**
 * @jest-environment node
 *
 * Server Actions des liens courts (P10), avec une base factice : validation avant toute
 * écriture, refus de la base traduits, contrôle de concurrence, journal platform_logs
 * (target_type 'link', slug et noms des champs seulement) et, si le journal échoue,
 * écriture annulée et action refusée (adminLogRefusal).
 */

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };
const calls: Call[] = [];
/** Réponse de la base pour une requête (table, opération, filtres). */
let respond: (call: Call) => { data: unknown; error: unknown };
const logInsert = jest.fn();

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  const b: Record<string, unknown> = {};
  const chain = (fn?: (...args: unknown[]) => void) => (...args: unknown[]) => { fn?.(...args); return b; };
  Object.assign(b, {
    select: chain(),
    insert: chain((payload) => { call.op = 'insert'; call.payload = payload; }),
    update: chain((payload) => { call.op = 'update'; call.payload = payload; }),
    delete: chain(() => { call.op = 'delete'; }),
    eq: chain((col, value) => call.filters.push([col as string, value])),
    gte: chain((col, value) => call.filters.push([`${col}>=`, value])),
    order: chain(),
    range: chain(),
    single: chain(),
    maybeSingle: chain(),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      calls.push(call);
      return Promise.resolve(respond(call)).then(resolve, reject);
    },
  });
  return b;
}

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' }),
  createClient: jest.fn(),
  getServerEnvironment: jest.fn().mockResolvedValue('production'),
  getAdminClient: jest.fn(async () => ({
    from: (table: string) => (table === 'platform_logs' ? { insert: logInsert } : builder(table)),
  })),
}));

import { requireAdmin } from '@/lib/supabase/server';
import {
  createShortLinkAction,
  exportShortLinkStatsCsvAction,
  getShortLinkStatsAction,
  listShortLinksAction,
  setShortLinkActiveAction,
  updateShortLinkAction,
  updateShortLinkSettingsAction,
} from '@/lib/actions/shortLinks';
import { ADMIN_LOG_WRITE_FAILED_MESSAGE } from '@/lib/audit/messages';
import { SHORT_LINK_CONFLICT_MESSAGE, TARGET_RULE_MESSAGE } from '@/lib/links/shortLinkRules';

const ID = '11111111-2222-4333-8444-555555555555';
const T0 = '2026-11-27T10:00:00.123456+00:00';
const T1 = '2026-11-27T11:00:00.654321+00:00';
const row = {
  id: ID, slug: 'flyer-lyon', label: 'Flyers chez Jean Dupont', kind: 'web',
  target_default: 'https://app.theresto.fr/', target_ios: null, target_android: null,
  forward_params: 'none', src: null, ville: 'lyon', persona: 'client', campaign: null,
  active: true, expires_at: null, created_at: T0, updated_at: T0,
};
const input = {
  slug: 'flyer-lyon', label: 'Flyers chez Jean Dupont', kind: 'web', targetDefault: 'https://app.theresto.fr/',
  targetIos: null, targetAndroid: null, forwardParams: 'none', src: null, ville: 'lyon', persona: 'client',
  campaign: null, expiresAt: null,
};
const logged = () => logInsert.mock.calls.map(([r]) => r);
const writes = () => calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  calls.length = 0;
  jest.clearAllMocks();
  logInsert.mockResolvedValue({ error: null });
  respond = (call) => {
    if (call.table === 'short_links' && call.op === 'select') return { data: row, error: null };
    if (call.table === 'short_links' && call.op === 'insert') return { data: row, error: null };
    if (call.table === 'short_links' && call.op === 'update') {
      return { data: { ...row, ...(call.payload as object), updated_at: T1 }, error: null };
    }
    return { data: null, error: null };
  };
});

describe('création', () => {
  it('écrit, journalise le slug et les noms des champs (jamais le libellé)', async () => {
    const r = await createShortLinkAction(input);
    expect(r).toMatchObject({ ok: true, data: { id: ID, slug: 'flyer-lyon' } });
    expect(writes()).toEqual([expect.objectContaining({
      table: 'short_links', op: 'insert', payload: expect.objectContaining({ slug: 'flyer-lyon', created_by: 'admin-1' }),
    })]);
    expect(logged()).toEqual([expect.objectContaining({
      action: 'create_short_link', target_type: 'link', target_id: ID, performed_by: 'admin-1',
      details: { slug: 'flyer-lyon', fields: ['slug', 'label', 'kind', 'target_default', 'forward_params', 'ville', 'persona'] },
    })]);
    expect(JSON.stringify(logged())).not.toContain('Dupont');
  });

  it('journal en échec : lien retiré, action refusée', async () => {
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(createShortLinkAction(input)).resolves.toEqual({
      ok: false, code: 'audit-log-failed', error: ADMIN_LOG_WRITE_FAILED_MESSAGE,
    });
    expect(writes().map((c) => [c.op, c.filters])).toEqual([['insert', []], ['delete', [['id', ID]]]]);
  });

  it('saisie invalide : aucune écriture', async () => {
    const r = await createShortLinkAction({ ...input, targetDefault: 'https://evil.com/' });
    expect(r).toEqual({ ok: false, code: 'invalid-argument', error: `Cible par défaut : ${TARGET_RULE_MESSAGE}` });
    expect(calls).toEqual([]);
    expect(logInsert).not.toHaveBeenCalled();
  });

  it.each([
    ['22023', 'Cible non autorisée'],
    ['23505', 'déjà pris'],
    ['23514', 'Format refusé'],
  ])('refus %s de la base traduit, rien de journalisé', async (code, text) => {
    respond = () => ({ data: null, error: { code, message: 'new row violates check constraint' } });
    const r = await createShortLinkAction(input);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe(code);
    expect(!r.ok && r.error).toContain(text);
    expect(logInsert).not.toHaveBeenCalled();
  });
});

describe('modification', () => {
  it('seuls les champs modifiés sont écrits et journalisés, filtre sur updated_at', async () => {
    const r = await updateShortLinkAction(ID, { ...input, ville: 'paris', slug: 'flyer-paris' }, T0);
    expect(r).toMatchObject({ ok: true, data: { slug: 'flyer-paris', ville: 'paris' } });
    const update = writes()[0];
    expect(update.payload).toEqual({ slug: 'flyer-paris', ville: 'paris' });
    expect(update.filters).toEqual([['id', ID], ['updated_at', T0]]);
    expect(logged()[0]).toMatchObject({
      action: 'update_short_link', target_type: 'link', target_id: ID,
      details: { slug: 'flyer-paris', previousSlug: 'flyer-lyon', fields: ['slug', 'ville'] },
    });
  });

  it('rien de changé : ni écriture ni journal', async () => {
    await expect(updateShortLinkAction(ID, input, T0)).resolves.toMatchObject({ ok: true });
    expect(writes()).toEqual([]);
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('date périmée : conflit sans écriture', async () => {
    await expect(updateShortLinkAction(ID, { ...input, ville: 'paris' }, T1)).resolves.toEqual({
      ok: false, code: 'conflict', error: SHORT_LINK_CONFLICT_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it('modifié entre la lecture et l écriture : conflit', async () => {
    const base = respond;
    respond = (call) => (call.op === 'update' ? { data: null, error: null } : base(call));
    await expect(updateShortLinkAction(ID, { ...input, ville: 'paris' }, T0)).resolves.toMatchObject({ code: 'conflict' });
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('journal en échec : valeurs d avant remises, action refusée', async () => {
    logInsert.mockResolvedValue({ error: { code: 'XX000' } });
    await expect(updateShortLinkAction(ID, { ...input, ville: 'paris' }, T0)).resolves.toEqual({
      ok: false, code: 'audit-log-failed', error: ADMIN_LOG_WRITE_FAILED_MESSAGE,
    });
    expect(writes().map((c) => [c.payload, c.filters])).toEqual([
      [{ ville: 'paris' }, [['id', ID], ['updated_at', T0]]],
      [{ ville: 'lyon' }, [['id', ID], ['updated_at', T1]]],
    ]);
  });

  it('identifiant mal formé : introuvable, aucune lecture', async () => {
    await expect(updateShortLinkAction('x', input, T0)).resolves.toMatchObject({ code: 'not-found' });
    expect(calls).toEqual([]);
  });
});

describe('désactivation et réactivation', () => {
  it('désactive (jamais de suppression) et journalise', async () => {
    await expect(setShortLinkActiveAction(ID, false, T0)).resolves.toMatchObject({ ok: true, data: { active: false } });
    expect(writes()).toEqual([expect.objectContaining({ op: 'update', payload: { active: false } })]);
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
    expect(logged()[0]).toMatchObject({ action: 'deactivate_short_link', details: { slug: 'flyer-lyon' } });
  });

  it('réactive', async () => {
    respond = (call) => (call.op === 'select'
      ? { data: { ...row, active: false }, error: null }
      : { data: { ...row, active: true, updated_at: T1 }, error: null });
    await setShortLinkActiveAction(ID, true, T0);
    expect(logged()[0]).toMatchObject({ action: 'reactivate_short_link' });
  });
});

describe('réglages des stores', () => {
  const settings = { app_store_url: null, play_store_url: null, app_store_provider_token: null, updated_at: T0, updated_by: null };
  beforeEach(() => {
    respond = (call) => (call.op === 'select'
      ? { data: settings, error: null }
      : { data: { ...settings, ...(call.payload as object), updated_at: T1 }, error: null });
  });
  const values = { appStoreUrl: 'https://apps.apple.com/fr/app/theresto/id1', playStoreUrl: null, appStoreProviderToken: null };

  it('journalisés (noms des champs), auteur écrit', async () => {
    await expect(updateShortLinkSettingsAction(values, T0)).resolves.toMatchObject({ ok: true });
    expect(writes()[0]).toMatchObject({
      table: 'short_link_settings',
      payload: { app_store_url: values.appStoreUrl, updated_by: 'admin-1' },
      filters: [['id', true], ['updated_at', T0]],
    });
    expect(logged()[0]).toMatchObject({
      action: 'update_short_link_settings', target_type: 'link', target_id: 'short_link_settings',
      details: { fields: ['app_store_url'] },
    });
  });

  it('journal en échec : réglages remis, action refusée', async () => {
    logInsert.mockResolvedValue({ error: { code: 'XX000' } });
    await expect(updateShortLinkSettingsAction(values, T0)).resolves.toMatchObject({ code: 'audit-log-failed' });
    expect(writes()[1]).toMatchObject({ payload: { app_store_url: null, updated_by: null }, filters: [['id', true], ['updated_at', T1]] });
  });

  it('lien Play d un autre paquet : refusé sans écriture', async () => {
    const r = await updateShortLinkSettingsAction({ ...values, playStoreUrl: 'https://play.google.com/store/apps/details?id=com.evil' }, T0);
    expect(r).toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(calls).toEqual([]);
  });
});

describe('lectures (agrégats, sans journal)', () => {
  it('liste : domaine de prod, scans des 30 jours par lien', async () => {
    respond = (call) => {
      if (call.table === 'short_links') return { data: [row], error: null };
      if (call.table === 'short_link_settings') return { data: { app_store_url: null, play_store_url: null, app_store_provider_token: null, updated_at: T0 }, error: null };
      return {
        data: [
          { link_id: ID, day: '2026-11-10', platform: 'ios', country: 'FR', src: '', ville: '', persona: '', hits: 3, bot_hits: 1 },
          { link_id: null, day: '2026-11-10', platform: 'ios', country: 'FR', src: '', ville: '', persona: '', hits: 2, bot_hits: 0 },
        ],
        error: null,
      };
    };
    const r = await listShortLinksAction();
    expect(r).toMatchObject({ ok: true, data: { domain: 'go.theresto.fr', unknownScans30d: 2, truncated: false } });
    expect(r.ok && r.data.links[0].scans30d).toBe(3);
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('statistiques : période refusée hors 30 / 90', async () => {
    await expect(getShortLinkStatsAction(ID, 365 as never)).resolves.toMatchObject({ code: 'invalid-argument' });
  });

  it('export CSV : agrégats, slug joint, sans journal', async () => {
    respond = (call) => (call.table === 'short_links'
      ? { data: [{ id: ID, slug: 'flyer-lyon' }], error: null }
      : { data: [{ link_id: ID, day: '2026-11-10', platform: 'ios', country: 'FR', src: '', ville: 'lyon', persona: 'client', hits: 3, bot_hits: 1 }], error: null });
    const r = await exportShortLinkStatsCsvAction({ linkId: ID, days: 30 });
    expect(r.ok && r.data.csv).toContain('2026-11-10,flyer-lyon,ios,FR,,lyon,client,3,1');
    expect(r.ok && r.data.filename).toMatch(/^scans-flyer-lyon-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('requireAdmin en échec : aucune lecture', async () => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(listShortLinksAction()).rejects.toThrow('Unauthorized');
    expect(calls).toEqual([]);
  });
});

describe('droits de service_role (migration)', () => {
  it('accepts_query_attributes n est jamais écrit (lecture seule, telecharger seulement)', async () => {
    await createShortLinkAction({ ...input, acceptsQueryAttributes: true });
    await updateShortLinkAction(ID, { ...input, ville: 'paris', acceptsQueryAttributes: true }, T0);
    for (const call of writes()) expect(JSON.stringify(call.payload)).not.toContain('accepts_query_attributes');
  });

  it('ni INSERT, ni DELETE, ni upsert sur short_link_settings et link_visit_daily ; pas de short_link_resolve', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src: string = require('fs').readFileSync(require('path').resolve(__dirname, '../../lib/actions/shortLinks.ts'), 'utf8');
    expect(src).not.toMatch(/\.upsert\(/);
    expect(src).not.toMatch(/short_link_resolve'|rpc\(/);
    for (const table of ['short_link_settings', 'link_visit_daily']) {
      const uses = src.split(`from('${table}')`).slice(1).map((rest) => rest.slice(0, 200));
      for (const use of uses) expect(use).not.toMatch(/^\s*\.(insert|delete)\(/);
    }
  });

  it('la fiche expose accepts_query_attributes en lecture', async () => {
    respond = () => ({ data: { ...row, slug: 'telecharger', accepts_query_attributes: true }, error: null });
    const { getShortLinkAction } = await import('@/lib/actions/shortLinks');
    const r = await getShortLinkAction(ID);
    expect(r.ok && r.data.link.acceptsQueryAttributes).toBe(true);
  });
});
