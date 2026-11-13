/**
 * @jest-environment node
 *
 * Server Actions du style du QR et des logos importés (bucket privé qr-logos), avec une base
 * et un stockage factices : admin exigé, style et chemin validés, fichier contrôlé (taille,
 * octets, filtre SVG), journal platform_logs et, s'il échoue, fichier retiré ou style remis.
 */
import fs from 'fs';
import path from 'path';

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };
const calls: Call[] = [];
let respond: (call: Call) => { data: unknown; error: unknown };
const logInsert = jest.fn();
const storage = {
  exists: jest.fn(),
  upload: jest.fn(),
  remove: jest.fn(),
  download: jest.fn(),
};
const bucketNames: string[] = [];

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  const b: Record<string, unknown> = {};
  const chain = (fn?: (...args: unknown[]) => void) => (...args: unknown[]) => { fn?.(...args); return b; };
  Object.assign(b, {
    select: chain(),
    update: chain((payload) => { call.op = 'update'; call.payload = payload; }),
    eq: chain((col, value) => call.filters.push([col as string, value])),
    neq: chain((col, value) => call.filters.push([`${col}!=`, value])),
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
    storage: { from: (bucket: string) => { bucketNames.push(bucket); return storage; } },
  })),
}));

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';
import {
  discardQrLogoAction,
  readQrLogoAction,
  saveShortLinkQrStyleAction,
  uploadQrLogoAction,
} from '@/lib/actions/shortLinks';
import { ADMIN_LOG_WRITE_FAILED_MESSAGE } from '@/lib/audit/messages';
import { SHORT_LINK_CONFLICT_MESSAGE } from '@/lib/links/shortLinkRules';
import { MAX_LOGO_BYTES } from '@/lib/links/qrCode';

const ID = '11111111-2222-4333-8444-555555555555';
const T0 = '2026-11-27T10:00:00.123456+00:00';
const T1 = '2026-11-27T11:00:00.654321+00:00';
const OLD_LOGO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png';
const NEW_LOGO = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.svg';
const LOGO_SVG = fs.readFileSync(path.resolve(__dirname, '../../public/qr-logo.svg'), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

const style = { v: 1, modules: 'dots', eyeFrame: 'rounded', eyeDot: 'circle', fg: '#111111', bg: '#FFFFFF', logo: 'theresto' };
const customStyle = { ...style, logo: 'custom', logoPath: NEW_LOGO };
const oldStyle = { ...style, modules: 'square', logo: 'custom', logoPath: OLD_LOGO };
const row = {
  id: ID, slug: 'flyer-lyon', label: 'Flyers chez Jean Dupont', kind: 'web',
  target_default: 'https://app.theresto.fr/', target_ios: null, target_android: null,
  forward_params: 'none', src: null, ville: 'lyon', persona: 'client', campaign: null,
  accepts_query_attributes: false, active: true, expires_at: null, qr_style: null as unknown,
  created_at: T0, updated_at: T0,
};
let current = row;
const logged = () => logInsert.mock.calls.map(([r]) => r);
const writes = () => calls.filter((c) => c.op !== 'select');

function form(file: Blob | null, name = 'logo.png', linkId = ID): FormData {
  const f = new FormData();
  f.append('linkId', linkId);
  if (file) f.append('file', new File([file], name));
  return f;
}

beforeEach(() => {
  calls.length = 0;
  bucketNames.length = 0;
  jest.clearAllMocks();
  current = { ...row };
  logInsert.mockResolvedValue({ error: null });
  storage.exists.mockResolvedValue({ data: true, error: null });
  storage.upload.mockResolvedValue({ data: {}, error: null });
  storage.remove.mockResolvedValue({ data: [], error: null });
  storage.download.mockResolvedValue({ data: new Blob([PNG]), error: null });
  respond = (call) => {
    if (call.table === 'short_links' && call.op === 'select') {
      // Recherche des liens qui citent un logo : aucun par défaut.
      if (call.filters.some(([col]) => col === 'qr_style->>logoPath')) return { data: [], error: null };
      return { data: current, error: null };
    }
    if (call.table === 'short_links' && call.op === 'update') {
      return { data: { ...current, ...(call.payload as object), updated_at: T1 }, error: null };
    }
    return { data: null, error: null };
  };
});

describe('admin exigé', () => {
  it.each([
    ['saveShortLinkQrStyleAction', () => saveShortLinkQrStyleAction(ID, style, T0)],
    ['uploadQrLogoAction', () => uploadQrLogoAction(form(new Blob([PNG])))],
    ['discardQrLogoAction', () => discardQrLogoAction(ID, NEW_LOGO)],
    ['readQrLogoAction', () => readQrLogoAction(NEW_LOGO)],
  ])('%s : refus sans admin, ni base ni stockage', async (_name, call) => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(new Error('Accès refusé'));
    await expect(call()).rejects.toThrow('Accès refusé');
    expect(getAdminClient).not.toHaveBeenCalled();
  });
});

describe('saveShortLinkQrStyleAction', () => {
  it('écrit le style, journalise le seul nom du champ', async () => {
    const r = await saveShortLinkQrStyleAction(ID, style, T0);
    expect(r).toMatchObject({ ok: true, data: { qrStyle: style } });
    expect(writes()).toEqual([expect.objectContaining({
      op: 'update', payload: { qr_style: style }, filters: [['id', ID], ['updated_at', T0]],
    })]);
    expect(logged()).toEqual([expect.objectContaining({
      action: 'update_short_link_qr_style', target_type: 'link', target_id: ID,
      details: { slug: 'flyer-lyon', fields: ['qr_style'] },
    })]);
  });

  it.each([
    ['clé en trop', { ...style, extra: 1 }],
    ['forme inconnue', { ...style, modules: 'heart' }],
    ['couleur', { ...style, fg: 'red' }],
    ['logo custom sans chemin', { ...style, logo: 'custom' }],
    ['chemin hors racine', { ...style, logo: 'custom', logoPath: '../x.png' }],
    ['null', null],
  ])('style refusé (%s) : aucune lecture ni écriture', async (_label, value) => {
    const r = await saveShortLinkQrStyleAction(ID, value, T0);
    expect(r).toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(calls).toEqual([]);
    expect(storage.exists).not.toHaveBeenCalled();
  });

  it('logo custom absent du bucket : refusé sans écriture', async () => {
    storage.exists.mockResolvedValue({ data: false, error: { status: 404 } });
    const r = await saveShortLinkQrStyleAction(ID, customStyle, T0);
    expect(r).toMatchObject({ ok: false, code: 'invalid-argument', error: expect.stringContaining('Logo introuvable') });
    expect(storage.exists).toHaveBeenCalledWith(NEW_LOGO);
    expect(bucketNames).toEqual(['qr-logos']);
    expect(writes()).toEqual([]);
  });

  it('conflit updated_at : aucune écriture', async () => {
    await expect(saveShortLinkQrStyleAction(ID, style, T1)).resolves.toEqual({
      ok: false, code: 'conflict', error: SHORT_LINK_CONFLICT_MESSAGE,
    });
    expect(writes()).toEqual([]);
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('même style relu de la base (clés dans un autre ordre) : ni écriture ni journal', async () => {
    current = { ...row, qr_style: { bg: '#FFFFFF', fg: '#111111', v: 1, logo: 'theresto', eyeDot: 'circle', modules: 'dots', eyeFrame: 'rounded' } };
    await expect(saveShortLinkQrStyleAction(ID, style, T0)).resolves.toMatchObject({ ok: true });
    expect(writes()).toEqual([]);
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('ancien logo importé remplacé : supprimé s il n est plus cité', async () => {
    current = { ...row, qr_style: oldStyle };
    await expect(saveShortLinkQrStyleAction(ID, customStyle, T0)).resolves.toMatchObject({ ok: true });
    expect(storage.remove).toHaveBeenCalledWith([OLD_LOGO]);
  });

  it('ancien logo encore cité par un autre lien : gardé', async () => {
    current = { ...row, qr_style: oldStyle };
    const base = respond;
    respond = (call) => (call.filters.some(([col]) => col === 'qr_style->>logoPath') ? { data: [{ id: 'x' }], error: null } : base(call));
    await expect(saveShortLinkQrStyleAction(ID, style, T0)).resolves.toMatchObject({ ok: true });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('suppression de l ancien logo en échec : l enregistrement réussit quand même', async () => {
    current = { ...row, qr_style: oldStyle };
    storage.remove.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(saveShortLinkQrStyleAction(ID, style, T0)).resolves.toMatchObject({ ok: true });
  });

  it('journal en échec : ancien style remis, action refusée, ancien logo gardé', async () => {
    current = { ...row, qr_style: oldStyle };
    logInsert.mockResolvedValue({ error: { code: 'XX000' } });
    await expect(saveShortLinkQrStyleAction(ID, style, T0)).resolves.toEqual({
      ok: false, code: 'audit-log-failed', error: ADMIN_LOG_WRITE_FAILED_MESSAGE,
    });
    expect(writes().map((c) => [c.payload, c.filters])).toEqual([
      [{ qr_style: style }, [['id', ID], ['updated_at', T0]]],
      [{ qr_style: oldStyle }, [['id', ID], ['updated_at', T1]]],
    ]);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('uploadQrLogoAction', () => {
  it('dépose sous un uuid, type exact, sans remplacement, et journalise extension et taille', async () => {
    const r = await uploadQrLogoAction(form(new Blob([PNG]), 'Mon Logo.PNG'));
    expect(r.ok).toBe(true);
    const logoPath = r.ok ? r.data.logoPath : '';
    expect(logoPath).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/);
    expect(storage.upload).toHaveBeenCalledWith(logoPath, expect.any(Uint8Array), { contentType: 'image/png', upsert: false });
    expect(logged()).toEqual([expect.objectContaining({
      action: 'upload_qr_logo', target_type: 'link', target_id: ID,
      details: { slug: 'flyer-lyon', extension: 'png', bytes: PNG.length },
    })]);
    expect(JSON.stringify(logged())).not.toContain('Mon Logo');
  });

  it('SVG filtré par le même filtre que le moteur', async () => {
    const ok = await uploadQrLogoAction(form(new Blob([LOGO_SVG]), 'logo.svg'));
    expect(ok.ok).toBe(true);
    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/\.svg$/), expect.any(Uint8Array), { contentType: 'image/svg+xml', upsert: false });
    storage.upload.mockClear();
    const evil = await uploadQrLogoAction(form(new Blob(['<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>']), 'logo.svg'));
    expect(evil).toMatchObject({ ok: false, code: 'invalid-argument', error: expect.stringMatching(/^Logo SVG refusé/) });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('fichier trop gros : refusé sans dépôt', async () => {
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(PNG.subarray(0, 8));
    const r = await uploadQrLogoAction(form(new Blob([big])));
    expect(r).toMatchObject({ ok: false, error: 'Logo trop lourd : 512 Kio au plus.' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('PNG déguisé (SVG nommé .png) et extension refusée : refusés', async () => {
    const disguised = await uploadQrLogoAction(form(new Blob([LOGO_SVG]), 'logo.png'));
    expect(disguised).toMatchObject({ ok: false, error: 'Le contenu du fichier ne correspond pas à son extension.' });
    const gif = await uploadQrLogoAction(form(new Blob([PNG]), 'logo.gif'));
    expect(gif).toMatchObject({ ok: false, error: 'Format refusé : SVG, PNG ou JPEG attendu.' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('sans fichier ou lien mal formé : refusé', async () => {
    await expect(uploadQrLogoAction(form(null))).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
    await expect(uploadQrLogoAction(form(new Blob([PNG]), 'logo.png', '../x'))).resolves.toMatchObject({ ok: false, code: 'not-found' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('journal en échec : fichier retiré, adminLogRefusal', async () => {
    logInsert.mockResolvedValue({ error: { code: 'XX000' } });
    const r = await uploadQrLogoAction(form(new Blob([PNG])));
    expect(r).toEqual({ ok: false, code: 'audit-log-failed', error: ADMIN_LOG_WRITE_FAILED_MESSAGE });
    const uploaded = storage.upload.mock.calls[0][0];
    expect(storage.remove).toHaveBeenCalledWith([uploaded]);
  });
});

describe('discardQrLogoAction', () => {
  it('retire un logo jamais cité, après journal', async () => {
    await expect(discardQrLogoAction(ID, NEW_LOGO)).resolves.toEqual({ ok: true, data: null });
    expect(logged()[0]).toMatchObject({ action: 'discard_qr_logo', details: { extension: 'svg' } });
    expect(storage.remove).toHaveBeenCalledWith([NEW_LOGO]);
  });

  it('logo cité par un lien : gardé', async () => {
    respond = () => ({ data: [{ id: ID }], error: null });
    await expect(discardQrLogoAction(ID, NEW_LOGO)).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('chemin ../x.png refusé', async () => {
    await expect(discardQrLogoAction(ID, '../x.png')).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('journal en échec : fichier gardé', async () => {
    logInsert.mockResolvedValue({ error: { code: 'XX000' } });
    await expect(discardQrLogoAction(ID, NEW_LOGO)).resolves.toMatchObject({ code: 'audit-log-failed' });
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('readQrLogoAction', () => {
  it('renvoie le contenu revérifié, jamais une URL', async () => {
    const r = await readQrLogoAction(OLD_LOGO);
    expect(r).toEqual({ ok: true, data: { kind: 'raster', mime: 'image/png', base64: PNG.toString('base64') } });
    expect(storage.download).toHaveBeenCalledWith(OLD_LOGO);
  });

  it.each(['../x.png', 'dossier/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png', 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE.png', 'x.gif'])(
    'chemin %s refusé sans lecture', async (p) => {
      await expect(readQrLogoAction(p)).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
      expect(storage.download).not.toHaveBeenCalled();
    },
  );

  it('contenu du bucket refusé par le filtre : erreur, rien renvoyé', async () => {
    storage.download.mockResolvedValue({ data: new Blob(['<svg viewBox="0 0 1 1"><script/></svg>']), error: null });
    await expect(readQrLogoAction(NEW_LOGO)).resolves.toMatchObject({ ok: false, error: expect.stringMatching(/^Logo SVG refusé/) });
  });

  it('fichier absent : introuvable', async () => {
    storage.download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    await expect(readQrLogoAction(NEW_LOGO)).resolves.toMatchObject({ ok: false, code: 'not-found' });
  });
});
