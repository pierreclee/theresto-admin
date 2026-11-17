/**
 * @jest-environment node
 *
 * Alertes des restaurants (chantier B, lot B6) : RPC appelées après requireAdmin(), lectures
 * journalisées sans donnée de client et refusées si le journal échoue (D2), seuils écrits
 * avec contrôle de version (PT409) et remis à l'ancienne valeur si le journal échoue.
 */
const rpc = jest.fn();
const logInsert = jest.fn();
const usersRow: { data: unknown; error: unknown } = { data: { email: 'autre-admin@theresto.fr' }, error: null };

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@theresto.fr' }),
  createClient: jest.fn(),
  getAdminClient: jest.fn(async () => ({
    rpc,
    from: (table: string) => {
      if (table === 'platform_logs') return { insert: logInsert };
      const b = { select: () => b, eq: () => b, maybeSingle: async () => usersRow };
      return b;
    },
  })),
}));

import { requireAdmin } from '@/lib/supabase/server';
import {
  getAlertSettingsAction,
  getPendingLapseDetailAction,
  getPendingLapseStatsAction,
  getRestaurantAlertsAction,
  updateAlertSettingsAction,
} from '@/lib/actions/restaurantAlerts';
import { ADMIN_LOG_FAILED_MESSAGE, ADMIN_LOG_WRITE_FAILED_MESSAGE } from '@/lib/audit/messages';
import { ALERT_SETTINGS_CONFLICT_MESSAGE } from '@/lib/utils/restaurantAlerts';

const RID = '11111111-2222-4333-8444-555555555555';
const T0 = '2026-11-30T10:00:00.123+00:00';
const T1 = '2026-11-30T11:00:00.456+00:00';
const settings = (count: number, rate: number, at: string, by: string | null = null) => ({
  pending_lapse_min_count: count, pending_lapse_min_rate: rate,
  pending_lapse_tracking_since: '2026-11-17T00:00:00+00:00', updated_at: at, updated_by: by,
});
const logged = () => logInsert.mock.calls.map(([row]) => row);

beforeEach(() => {
  rpc.mockReset();
  logInsert.mockReset();
  logInsert.mockResolvedValue({ error: null });
  (requireAdmin as jest.Mock).mockClear();
});

describe('getRestaurantAlertsAction', () => {
  const rows = [
    { restaurant_id: RID, restaurant_name: 'Chez Paul', kind: 'pending_lapse', severity: 'warning', since: T0,
      metrics: { lapsed_30d: 5, total_30d: 50 }, total_rows: 3, total_restaurants: 2 },
    { restaurant_id: RID, restaurant_name: 'Chez Paul', kind: 'ontime_late', severity: 'info', since: null,
      metrics: null, total_rows: 3, total_restaurants: 2 },
  ];

  it('toutes les alertes, journalisées avec les nombres seulement', async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    const result = await getRestaurantAlertsAction();
    expect(requireAdmin).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('admin_restaurant_alerts', { p_restaurant_id: null, p_limit: 1000, p_offset: 0 });
    expect(result).toEqual({
      ok: true,
      data: {
        total: 3,
        totalRestaurants: 2,
        alerts: [
          expect.objectContaining({ restaurantId: RID, kind: 'pending_lapse', metrics: { lapsed_30d: 5, total_30d: 50 } }),
          expect.objectContaining({ kind: 'ontime_late', metrics: {} }),
        ],
      },
    });
    expect(logged()).toEqual([expect.objectContaining({
      action: 'view_restaurant_alerts', target_type: 'restaurant', target_id: null, performed_by: 'admin-1',
      details: { count: 3, restaurants: 2 },
    })]);
    expect(JSON.stringify(logged())).not.toContain('Chez Paul');
  });

  it('un restaurant : id transmis et journalisé', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getRestaurantAlertsAction(RID)).resolves.toEqual({ ok: true, data: { alerts: [], total: 0, totalRestaurants: 0 } });
    expect(rpc).toHaveBeenCalledWith('admin_restaurant_alerts', expect.objectContaining({ p_restaurant_id: RID }));
    expect(logged()[0]).toMatchObject({ target_id: RID });
  });

  it('id mal formé : ni lecture ni journal', async () => {
    await expect(getRestaurantAlertsAction('pas-un-uuid')).resolves.toMatchObject({ ok: false, code: 'not-found' });
    expect(rpc).not.toHaveBeenCalled();
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('journal en échec : consultation refusée (D2)', async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(getRestaurantAlertsAction()).resolves.toEqual({ ok: false, code: 'audit-log-failed', error: ADMIN_LOG_FAILED_MESSAGE });
  });

  it('erreur de la base : message français, jamais le message brut', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'function does not exist' } });
    const result = await getRestaurantAlertsAction();
    expect(result).toMatchObject({ ok: false, error: 'Impossible de charger les alertes.' });
    expect(logInsert).not.toHaveBeenCalled();
  });
});

describe('getPendingLapseStatsAction', () => {
  it('lignes converties (taux numeric en nombre), journalisées', async () => {
    rpc.mockResolvedValue({
      data: [{ restaurant_id: RID, lapsed_30d: 5, total_30d: 50, rate_30d: '0.1000', lapsed_prev_30d: 0, total_prev_30d: 0,
        rate_prev_30d: null, last_lapse_at: T0, alert: true, total_rows: 1 }],
      error: null,
    });
    const result = await getPendingLapseStatsAction(true);
    expect(rpc).toHaveBeenCalledWith('admin_pending_lapse_stats', { p_only_alerts: true, p_limit: 1000, p_offset: 0 });
    expect(result).toEqual({ ok: true, data: { total: 1, stats: [expect.objectContaining({ rate30d: 0.1, ratePrev30d: null, alert: true })] } });
    expect(logged()).toEqual([expect.objectContaining({ action: 'view_restaurant_pending_lapse_stats', details: { count: 1, onlyAlerts: true } })]);
  });
});

describe('getPendingLapseDetailAction', () => {
  it('fiche lue et journalisée avec la page', async () => {
    rpc.mockResolvedValue({ data: { restaurant_id: RID, closures: { items: [] } }, error: null });
    await expect(getPendingLapseDetailAction(RID, 20)).resolves.toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith('admin_restaurant_pending_lapses', {
      p_restaurant_id: RID, p_weeks: 12, p_days: 30, p_limit: 20, p_offset: 20,
    });
    expect(logged()).toEqual([expect.objectContaining({
      action: 'view_restaurant_pending_lapses', target_type: 'restaurant', target_id: RID, details: { offset: 20 },
    })]);
  });

  it('champs du contrat seulement : un champ inattendu n atteint pas le navigateur', async () => {
    rpc.mockResolvedValue({
      data: {
        restaurant_id: RID, computed_at: T0, customer_email: 'client@exemple.fr',
        settings: { pending_lapse_min_count: 5, pending_lapse_min_rate: '0.1000', pending_lapse_tracking_since: T0 },
        current: { lapsed: 1, total: 2, rate: '0.5000', last_lapse_at: T0, alert: false },
        previous: { lapsed: 0, total: 0, rate: null },
        trend: [],
        closures: { days: 30, total: 1, limit: 20, offset: 0, items: [{
          booking_date: '2026-11-29', booking_time: '20:00', number_of_guests: 2, booking_source: 'app',
          reservation_type: 'tableReservation', previous_status: 'pending', service_end_at: T0, closed_at: T1,
          booking_id: 'b-1', customer_name: 'Jean Dupont',
        }] },
      },
      error: null,
    });
    const result = await getPendingLapseDetailAction(RID);
    expect(JSON.stringify(result)).not.toMatch(/client@exemple|Jean Dupont|b-1/);
    expect(result).toMatchObject({ ok: true, data: { current: { rate: 0.5 }, settings: { pending_lapse_min_rate: 0.1 } } });
  });

  it('page invalide ramenée à 0', async () => {
    rpc.mockResolvedValue({ data: { restaurant_id: RID }, error: null });
    await getPendingLapseDetailAction(RID, -3);
    expect(rpc).toHaveBeenCalledWith('admin_restaurant_pending_lapses', expect.objectContaining({ p_offset: 0 }));
  });

  it('restaurant inconnu (P0002) : introuvable, rien de journalisé', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'restaurant not found' } });
    await expect(getPendingLapseDetailAction(RID)).resolves.toEqual({ ok: false, code: 'not-found', error: 'Restaurant introuvable.' });
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('journal en échec : refusée', async () => {
    rpc.mockResolvedValue({ data: { restaurant_id: RID }, error: null });
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(getPendingLapseDetailAction(RID)).resolves.toMatchObject({ ok: false, code: 'audit-log-failed' });
  });
});

describe('getAlertSettingsAction', () => {
  it('seuils lus, auteur résolu, sans journal', async () => {
    rpc.mockResolvedValue({ data: settings(5, 0.1, T0, 'admin-2'), error: null });
    await expect(getAlertSettingsAction()).resolves.toEqual({
      ok: true,
      data: { minCount: 5, minRate: 0.1, trackingSince: '2026-11-17T00:00:00+00:00', updatedAt: T0, updatedBy: 'autre-admin@theresto.fr' },
    });
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('modifiés par l admin connecté : « vous »', async () => {
    rpc.mockResolvedValue({ data: settings(5, 0.1, T0, 'admin-1'), error: null });
    await expect(getAlertSettingsAction()).resolves.toMatchObject({ ok: true, data: { updatedBy: 'vous' } });
  });
});

describe('updateAlertSettingsAction', () => {
  it.each([
    [{ minCount: 0, minRatePercent: 10 }],
    [{ minCount: 1001, minRatePercent: 10 }],
    [{ minCount: 2.5, minRatePercent: 10 }],
    [{ minCount: 5, minRatePercent: 101 }],
    [{ minCount: 5, minRatePercent: 7.125 }],
    [{ minCount: 5, minRatePercent: '10' }],
    [null],
  ])('valeurs refusées avant la base : %j', async (values) => {
    await expect(updateAlertSettingsAction(values, T0)).resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('version absente : conflit', async () => {
    await expect(updateAlertSettingsAction({ minCount: 5, minRatePercent: 10 }, '')).resolves.toMatchObject({ code: 'conflict' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('pourcentage envoyé en fraction exacte, journal previous → current', async () => {
    rpc.mockResolvedValue({
      data: { changed: true, previous: settings(5, 0.1, T0), current: settings(3, 0.073, T1, 'admin-1') },
      error: null,
    });
    const result = await updateAlertSettingsAction({ minCount: 3, minRatePercent: 7.3 }, T0);
    expect(rpc).toHaveBeenCalledWith('admin_update_restaurant_alert_settings', {
      p_pending_lapse_min_count: 3, p_pending_lapse_min_rate: 0.073, p_expected_updated_at: T0, p_admin_id: 'admin-1',
    });
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ minCount: 3, minRate: 0.073, updatedAt: T1, changed: true }) });
    expect(logged()).toEqual([expect.objectContaining({
      action: 'update_restaurant_alert_settings', target_type: 'config', target_id: 'restaurant_alert_settings',
      details: { previous: { min_count: 5, min_rate: 0.1 }, current: { min_count: 3, min_rate: 0.073 } },
    })]);
  });

  it('valeurs identiques : rien de journalisé', async () => {
    rpc.mockResolvedValue({ data: { changed: false, previous: settings(5, 0.1, T0), current: settings(5, 0.1, T0) }, error: null });
    await expect(updateAlertSettingsAction({ minCount: 5, minRatePercent: 10 }, T0))
      .resolves.toMatchObject({ ok: true, data: { changed: false } });
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('modifiés entre-temps (PT409) : message de conflit, rien de journalisé', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'restaurant_alert_settings changed since it was read' } });
    await expect(updateAlertSettingsAction({ minCount: 5, minRatePercent: 10 }, T0))
      .resolves.toEqual({ ok: false, code: 'conflict', error: ALERT_SETTINGS_CONFLICT_MESSAGE });
    expect(logInsert).not.toHaveBeenCalled();
  });

  it('refus 22023 de la base : valeurs invalides', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'x' } });
    await expect(updateAlertSettingsAction({ minCount: 5, minRatePercent: 10 }, T0))
      .resolves.toMatchObject({ ok: false, code: 'invalid-argument' });
  });

  it('journal en échec : anciennes valeurs remises sur la version écrite, modification refusée', async () => {
    rpc
      .mockResolvedValueOnce({ data: { changed: true, previous: settings(5, 0.1, T0), current: settings(3, 0.2, T1, 'admin-1') }, error: null })
      .mockResolvedValueOnce({ data: { changed: true }, error: null });
    logInsert.mockResolvedValue({ error: { code: '42501' } });
    await expect(updateAlertSettingsAction({ minCount: 3, minRatePercent: 20 }, T0))
      .resolves.toEqual({ ok: false, code: 'audit-log-failed', error: ADMIN_LOG_WRITE_FAILED_MESSAGE });
    expect(rpc).toHaveBeenLastCalledWith('admin_update_restaurant_alert_settings', {
      p_pending_lapse_min_count: 5, p_pending_lapse_min_rate: 0.1, p_expected_updated_at: T1, p_admin_id: 'admin-1',
    });
  });
});
