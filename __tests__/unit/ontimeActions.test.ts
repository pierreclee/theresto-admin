/**
 * @jest-environment node
 *
 * OnTime (chantier C, lot C5) : RPC admin_* appelées après requireAdmin() avec l'admin de la
 * session ; jamais de logAdminAction en plus (les RPC journalisent dans leur transaction) ;
 * écritures refusées sans code TOTP de moins de 5 minutes ; statuts stale / invalid_state /
 * not_found traduits ; allumage des sanctions refusé sans confirmation des CGV 1.2.
 */
const rpc = jest.fn();
const logInsert = jest.fn();
const getSession = jest.fn();
const settingsRow: { data: unknown; error: unknown } = { data: null, error: null };

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' }),
  createClient: jest.fn(async () => ({ auth: { getSession } })),
  getAdminClient: jest.fn(async () => ({
    rpc,
    from: (table: string) => {
      if (table === 'platform_logs') return { insert: logInsert };
      const b = { select: () => b, maybeSingle: async () => settingsRow };
      return b;
    },
  })),
}));

import { requireAdmin } from '@/lib/supabase/server';
import {
  decideOntimeReportAction,
  getOntimeOverviewAction,
  getOntimeSanctionsSwitchAction,
  liftOntimeSanctionAction,
  listOntimeReportsAction,
  setOntimeSanctionsAction,
  voidOntimeReportAction,
  withdrawOntimeAction,
} from '@/lib/actions/ontime';

const RID = '11111111-2222-4333-8444-555555555555';
const REPORT_ID = '22222222-2222-4333-8444-555555555555';
const T0 = '2026-12-01T10:00:00.123+00:00';

function jwt(claims: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}
const now = () => Math.floor(Date.now() / 1000);
const freshSession = () => ({ data: { session: { access_token: jwt({ aal: 'aal2', amr: [{ method: 'totp', timestamp: now() - 30 }] }) } } });
const staleSession = () => ({ data: { session: { access_token: jwt({ aal: 'aal2', amr: [{ method: 'totp', timestamp: now() - 3600 }] }) } } });

const report = (over: Record<string, unknown> = {}) => ({
  id: REPORT_ID, restaurant_id: RID, booking_id: 'b1', slot_at: T0, number_of_guests: 2, delay_category: '20_40',
  comment: 'Servi tard', status: 'contested', reported_at: T0, contest_deadline: T0, contest_paused: false,
  contest_remaining_seconds: null, contestable: false, contested_at: T0, contest_text: 'Faux', contest_source: 'team',
  decided_at: null, decision_source: null, decision_reason: null, voided_at: null, void_reason: null, withdrawn_at: null,
  updated_at: T0, reporter_erased: false, booking_facts: { status: 'completed', arrived: true, auto_honored: false },
  reporter_user_id: 'NE-DOIT-PAS-SORTIR', ...over,
});

beforeEach(() => {
  rpc.mockReset();
  logInsert.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue(freshSession());
  (requireAdmin as jest.Mock).mockClear();
});

afterEach(() => {
  // Les RPC admin_* journalisent elles-mêmes : jamais de ligne écrite par l'admin.
  expect(logInsert).not.toHaveBeenCalled();
});

describe('lectures', () => {
  it('liste : admin de la session, champs du contrat seulement', async () => {
    rpc.mockResolvedValue({ data: { status: 'ok', total: 1, reports: [{ ...report(), restaurant_name: 'Chez Paul' }] }, error: null });
    const result = await listOntimeReportsAction('contested', 0);
    expect(requireAdmin).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('admin_ontime_reports', {
      p_status: 'contested', p_restaurant_id: null, p_limit: 50, p_offset: 0, p_admin_id: 'admin-1', p_admin_email: 'admin@theresto.fr',
    });
    expect(result).toMatchObject({ ok: true, data: { total: 1, reports: [{ id: REPORT_ID, restaurant_name: 'Chez Paul' }] } });
    expect(JSON.stringify(result)).not.toContain('NE-DOIT-PAS-SORTIR');
  });

  it('filtre inconnu refusé sans appel', async () => {
    await expect(listOntimeReportsAction('nope' as never)).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fiche : not_found traduit', async () => {
    rpc.mockResolvedValue({ data: { status: 'not_found' }, error: null });
    await expect(getOntimeOverviewAction(RID)).resolves.toMatchObject({ ok: false, code: 'not-found' });
  });

  it('erreur de la RPC (journal impossible compris) : refus, sans message brut', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for table platform_logs' } });
    const result = await getOntimeOverviewAction(RID);
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain('permission denied');
  });

  it('interrupteur lu dans platform_commission_settings', async () => {
    settingsRow.data = { ontime_sanctions_enabled: false, ontime_sanctions_updated_at: null, ontime_sanctions_enabled_at: null };
    await expect(getOntimeSanctionsSwitchAction()).resolves.toEqual({ ok: true, data: { enabled: false, updatedAt: null, enabledAt: null } });
  });
});

describe('écritures', () => {
  const decide = (over: Record<string, unknown> = {}) =>
    decideOntimeReportAction({ reportId: REPORT_ID, decision: 'upheld', reason: 'Aucune preuve de service à l’heure.', expectedUpdatedAt: T0, ...over } as never);

  it('code TOTP de plus de 5 minutes : refus sans appel', async () => {
    getSession.mockResolvedValue(staleSession());
    await expect(decide()).resolves.toMatchObject({ ok: false, code: 'mfa-required' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('motif trop court : refus sans appel', async () => {
    await expect(decide({ reason: ' court ' })).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('décision : arguments du contrat, sanction renvoyée', async () => {
    rpc.mockResolvedValue({
      data: { status: 'ok', report: report({ status: 'upheld' }), sanction: { id: 's1', restaurant_id: RID, kind: 'warning', created_at: T0, starts_at: T0, updated_at: T0 } },
      error: null,
    });
    const result = await decide({ reason: '  Aucune preuve de service à l’heure.  ' });
    expect(rpc).toHaveBeenCalledWith('admin_decide_ontime_report', {
      p_report_id: REPORT_ID, p_decision: 'upheld', p_reason: 'Aucune preuve de service à l’heure.',
      p_expected_updated_at: T0, p_admin_id: 'admin-1', p_admin_email: 'admin@theresto.fr',
    });
    expect(result).toMatchObject({ ok: true, data: { report: { status: 'upheld' }, sanction: { kind: 'warning' } } });
  });

  it.each([
    ['stale', 'conflict'],
    ['invalid_state', 'invalid-state'],
    ['not_found', 'not-found'],
  ])('statut %s → %s', async (status, code) => {
    rpc.mockResolvedValue({ data: { status, report: report() }, error: null });
    await expect(decide()).resolves.toMatchObject({ ok: false, code });
  });

  it('22023 (motif refusé par la base) traduit', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023' } });
    await expect(decide()).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
  });

  it('annulation : sanction déclenchée proposée à la levée', async () => {
    rpc.mockResolvedValue({
      data: { status: 'ok', report: report({ status: 'voided' }), triggered_sanction: { id: 's1', restaurant_id: RID, kind: 'suspension', created_at: T0, starts_at: T0, ends_at: T0, updated_at: T0 } },
      error: null,
    });
    const result = await voidOntimeReportAction({ reportId: REPORT_ID, reason: 'Fraude établie après vérification.', expectedUpdatedAt: T0 });
    expect(rpc.mock.calls[0][0]).toBe('admin_void_ontime_report');
    expect(result).toMatchObject({ ok: true, data: { triggeredSanction: { kind: 'suspension' } } });
  });

  it('retrait et levée', async () => {
    rpc.mockResolvedValue({ data: { status: 'ok', sanction: { id: 's2', restaurant_id: RID, kind: 'withdrawal', created_at: T0, starts_at: T0, updated_at: T0 } }, error: null });
    await expect(withdrawOntimeAction({ restaurantId: RID, reason: 'Récidive après deux suspensions.' })).resolves.toMatchObject({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith('admin_withdraw_ontime', {
      p_restaurant_id: RID, p_reason: 'Récidive après deux suspensions.', p_admin_id: 'admin-1', p_admin_email: 'admin@theresto.fr',
    });
    await expect(liftOntimeSanctionAction({ sanctionId: RID, reason: 'Mesures correctives justifiées.', expectedUpdatedAt: T0 }))
      .resolves.toMatchObject({ ok: true });
    expect(rpc.mock.calls[1][0]).toBe('admin_lift_ontime_sanction');
  });

  it('allumer les sanctions exige la confirmation des CGV 1.2', async () => {
    await expect(setOntimeSanctionsAction({ enabled: true, expectedUpdatedAt: null })).resolves.toMatchObject({ ok: false, code: 'confirmation-required' });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { status: 'ok', previous: false, enabled: true, updatedAt: T0, enabledAt: T0 }, error: null });
    await expect(setOntimeSanctionsAction({ enabled: true, expectedUpdatedAt: null, confirmCgv: true }))
      .resolves.toEqual({ ok: true, data: { previous: false, enabled: true, updatedAt: T0, enabledAt: T0 } });
    expect(rpc).toHaveBeenCalledWith('admin_set_ontime_sanctions', {
      p_enabled: true, p_expected_updated_at: null, p_admin_id: 'admin-1', p_admin_email: 'admin@theresto.fr',
    });
  });

  it('éteindre ne demande pas de confirmation ; conflit traduit', async () => {
    rpc.mockResolvedValue({ data: { status: 'stale', enabled: true, updatedAt: T0 }, error: null });
    await expect(setOntimeSanctionsAction({ enabled: false, expectedUpdatedAt: '2026-01-01T00:00:00Z' }))
      .resolves.toMatchObject({ ok: false, code: 'conflict' });
  });
});
