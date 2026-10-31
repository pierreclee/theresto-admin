/**
 * @jest-environment node
 *
 * RGPD-29 (lot 9, D2) : une Edge Function qui refuse une consultation faute de journal
 * (admin-restaurant-billing, liste des incidents) renvoie 503 avec le code « audit-log-failed » ;
 * les versions déployées avant la PR #60 renvoient 500 « internal » avec leur message.
 * invokeEdgeFunction traduit les deux en refus « audit-log-failed », comme les lectures de l'admin.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

const invoke = jest.fn();
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ functions: { invoke } })),
  getAdminClient: jest.fn(),
}));

import { invokeEdgeFunction } from '@/lib/supabase/invokeFunction';
import { ADMIN_LOG_FAILED_MESSAGE, EDGE_AUDIT_LOG_UNAVAILABLE } from '@/lib/audit/messages';

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => invoke.mockReset());

describe('invokeEdgeFunction', () => {
  it('code audit-log-failed (503) → refus audit-log-failed, quel que soit le message', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(503, { error: { code: 'audit-log-failed', message: 'texte reformulé' } }),
    });
    await expect(invokeEdgeFunction('admin-privatization-incidents', {})).resolves.toEqual({
      ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE,
    });
  });

  it('repli : ancien refus 500 « internal » reconnu à son message → audit-log-failed', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(500, { error: { code: 'internal', message: EDGE_AUDIT_LOG_UNAVAILABLE } }),
    });
    await expect(invokeEdgeFunction('admin-restaurant-billing', {})).resolves.toEqual({
      ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE,
    });
  });

  it('autre erreur interne inchangée', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(500, { error: { code: 'internal', message: 'boom' } }) });
    await expect(invokeEdgeFunction('x', {})).resolves.toEqual({ ok: false, code: 'internal', error: 'boom' });
  });

  it('succès : data.data', async () => {
    invoke.mockResolvedValue({ data: { data: { auditLogged: true } }, error: null });
    await expect(invokeEdgeFunction('x', {})).resolves.toEqual({ ok: true, data: { auditLogged: true } });
  });
});
