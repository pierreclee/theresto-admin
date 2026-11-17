'use server';

// Alertes des restaurants et suivi des demandes non confirmées (chantier B, lot B6).
// Contrat : docs/features/admin-restaurant-alerts.md du dépôt theresto_app (migration
// 20261130150000_admin_restaurant_alerts.sql). RPC SECURITY DEFINER exécutables par
// service_role seul : appelées avec la clé service, toujours après requireAdmin().
//
// Lectures : aucune donnée de client (ni nom, ni contact, ni identifiant de réservation),
// mais elles portent sur l'activité d'un établissement nommé : journalisées comme la fiche
// d'un restaurant, et refusées (adminLogRefusal) si le journal ne s'écrit pas (D2).
//
// Seuils : contrôle de version par updated_at (PT409 si la ligne a changé), journal de
// previous → current ; journal impossible : anciennes valeurs remises par la même RPC et
// modification refusée (adminLogRefusal(ADMIN_LOG_WRITE_FAILED_MESSAGE)), comme
// guardedLinkUpdate (shortLinks.ts). Pas de TOTP de 5 minutes : seuil d'affichage, sans
// effet sur un restaurant (requireAdmin suffit : AAL2 et TOTP de moins de 2 h).

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';
import { adminLogRefusal, logAdminAction } from '@/lib/audit/adminLog';
import { ADMIN_LOG_WRITE_FAILED_MESSAGE } from '@/lib/audit/messages';
import type { ActionResult } from '@/lib/supabase/invokeFunction';
import { ALERT_SETTINGS_CONFLICT_MESSAGE, CLOSURES_PAGE_SIZE, percentToRate } from '@/lib/utils/restaurantAlerts';
import type {
  PendingLapseDetail,
  PendingLapseStatsResult,
  RestaurantAlert,
  RestaurantAlertSettings,
  RestaurantAlertsResult,
} from '@/lib/types/restaurantAlerts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Toutes les alertes en une lecture (borne haute de la RPC). */
const ALERTS_LIMIT = 1000;
const STATS_LIMIT = 1000;
const SETTINGS_TARGET_ID = 'restaurant_alert_settings';

type DbError = { code?: string; message?: string } | null;

interface AlertRow {
  restaurant_id: string;
  restaurant_name: string | null;
  kind: string;
  severity: string;
  since: string | null;
  metrics: Record<string, unknown> | null;
  total_rows: number | string;
  total_restaurants: number | string;
}

interface StatRow {
  restaurant_id: string;
  lapsed_30d: number;
  total_30d: number;
  rate_30d: number | string | null;
  lapsed_prev_30d: number;
  total_prev_30d: number;
  rate_prev_30d: number | string | null;
  last_lapse_at: string | null;
  alert: boolean;
  total_rows: number | string;
}

interface SettingsJson {
  pending_lapse_min_count: number;
  pending_lapse_min_rate: number | string;
  pending_lapse_tracking_since: string;
  updated_at: string;
  updated_by: string | null;
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

function dbFailure(error: DbError, fallback: string): { ok: false; code: string; error: string } {
  // Code seulement : jamais le message brut (en anglais, parfois avec des valeurs).
  console.error('[alertes] refus de la base :', error?.code ?? 'erreur');
  if (error?.code === 'P0002') return { ok: false, code: 'not-found', error: 'Restaurant introuvable.' };
  if (error?.code === '22023') return { ok: false, code: 'invalid-argument', error: 'Valeurs invalides.' };
  return { ok: false, code: error?.code ?? 'internal', error: fallback };
}

const notFound = () => ({ ok: false as const, code: 'not-found', error: 'Restaurant introuvable.' });

// ─── Lectures ───────────────────────────────────────────────────────────────

/** Alertes de tous les restaurants (liste, tableau de bord) ou d'un seul (fiche). */
export async function getRestaurantAlertsAction(restaurantId?: string | null): Promise<ActionResult<RestaurantAlertsResult>> {
  const admin = await requireAdmin();
  if (restaurantId != null && (typeof restaurantId !== 'string' || !UUID.test(restaurantId))) return notFound();
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_restaurant_alerts', {
    p_restaurant_id: restaurantId ?? null,
    p_limit: ALERTS_LIMIT,
    p_offset: 0,
  });
  if (error) return dbFailure(error, 'Impossible de charger les alertes.');
  const rows = (data ?? []) as AlertRow[];
  const alerts: RestaurantAlert[] = rows.map((r) => ({
    restaurantId: r.restaurant_id,
    restaurantName: r.restaurant_name,
    kind: r.kind,
    severity: r.severity,
    since: r.since,
    metrics: r.metrics ?? {},
  }));
  const total = rows.length > 0 ? Number(rows[0].total_rows) : 0;
  const totalRestaurants = rows.length > 0 ? Number(rows[0].total_restaurants) : 0;

  const logged = await logAdminAction(admin, {
    action: 'view_restaurant_alerts',
    targetType: 'restaurant',
    targetId: restaurantId ?? null,
    details: { count: total, restaurants: totalRestaurants },
  });
  if (!logged) return adminLogRefusal();
  return { ok: true, data: { alerts, total, totalRestaurants } };
}

/** Indicateurs des demandes non confirmées de tous les restaurants (30 jours et 30 jours d'avant). */
export async function getPendingLapseStatsAction(onlyAlerts = false): Promise<ActionResult<PendingLapseStatsResult>> {
  const admin = await requireAdmin();
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_pending_lapse_stats', {
    p_only_alerts: onlyAlerts === true,
    p_limit: STATS_LIMIT,
    p_offset: 0,
  });
  if (error) return dbFailure(error, 'Impossible de charger les demandes non confirmées.');
  const rows = (data ?? []) as StatRow[];
  const total = rows.length > 0 ? Number(rows[0].total_rows) : 0;

  const logged = await logAdminAction(admin, {
    action: 'view_restaurant_pending_lapse_stats',
    targetType: 'restaurant',
    targetId: null,
    details: { count: total, onlyAlerts: onlyAlerts === true },
  });
  if (!logged) return adminLogRefusal();
  return {
    ok: true,
    data: {
      total,
      stats: rows.map((r) => ({
        restaurantId: r.restaurant_id,
        lapsed30d: r.lapsed_30d,
        total30d: r.total_30d,
        rate30d: num(r.rate_30d),
        lapsedPrev30d: r.lapsed_prev_30d,
        totalPrev30d: r.total_prev_30d,
        ratePrev30d: num(r.rate_prev_30d),
        lastLapseAt: r.last_lapse_at,
        alert: r.alert === true,
      })),
    },
  };
}

/** Fiche d'un restaurant : compteurs, évolution sur 12 semaines, fermetures paginées. */
export async function getPendingLapseDetailAction(
  restaurantId: string,
  offset = 0,
): Promise<ActionResult<PendingLapseDetail>> {
  const admin = await requireAdmin();
  if (typeof restaurantId !== 'string' || !UUID.test(restaurantId)) return notFound();
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_restaurant_pending_lapses', {
    p_restaurant_id: restaurantId,
    p_weeks: 12,
    p_days: 30,
    p_limit: CLOSURES_PAGE_SIZE,
    p_offset: safeOffset,
  });
  if (error) return dbFailure(error, 'Impossible de charger les demandes non confirmées.');
  if (!data) return notFound();

  const logged = await logAdminAction(admin, {
    action: 'view_restaurant_pending_lapses',
    targetType: 'restaurant',
    targetId: restaurantId,
    details: { offset: safeOffset },
  });
  if (!logged) return adminLogRefusal();
  return { ok: true, data: pickDetail(data as PendingLapseDetail) };
}

/**
 * Champs du contrat seulement (défense en profondeur) : si la RPC renvoyait un jour un champ
 * de plus, il n'atteindrait pas le navigateur sans revue.
 */
function pickDetail(d: PendingLapseDetail): PendingLapseDetail {
  const c = d.closures ?? { days: 30, total: 0, limit: CLOSURES_PAGE_SIZE, offset: 0, items: [] };
  return {
    restaurant_id: d.restaurant_id,
    computed_at: d.computed_at,
    settings: {
      pending_lapse_min_count: Number(d.settings?.pending_lapse_min_count),
      pending_lapse_min_rate: Number(d.settings?.pending_lapse_min_rate),
      pending_lapse_tracking_since: d.settings?.pending_lapse_tracking_since,
    },
    current: {
      lapsed: d.current?.lapsed ?? 0,
      total: d.current?.total ?? 0,
      rate: num(d.current?.rate),
      last_lapse_at: d.current?.last_lapse_at ?? null,
      alert: d.current?.alert === true,
    },
    previous: { lapsed: d.previous?.lapsed ?? 0, total: d.previous?.total ?? 0, rate: num(d.previous?.rate) },
    trend: (d.trend ?? []).map((w) => ({
      period_start: w.period_start,
      period_end: w.period_end,
      lapsed: w.lapsed,
      total: w.total,
      rate: num(w.rate),
      tracked: w.tracked !== false,
    })),
    closures: {
      days: c.days,
      total: c.total,
      limit: c.limit,
      offset: c.offset,
      items: (c.items ?? []).map((i) => ({
        booking_date: i.booking_date,
        booking_time: i.booking_time ?? null,
        number_of_guests: i.number_of_guests ?? null,
        booking_source: i.booking_source ?? null,
        reservation_type: i.reservation_type ?? null,
        previous_status: i.previous_status,
        service_end_at: i.service_end_at,
        closed_at: i.closed_at,
      })),
    },
  };
}

// ─── Seuils d'alerte ────────────────────────────────────────────────────────

/** Auteur affiché : « vous », l'e-mail de l'admin, ou null (jamais modifié, compte supprimé). */
async function authorLabel(
  db: Awaited<ReturnType<typeof getAdminClient>>,
  adminId: string,
  updatedBy: string | null,
): Promise<string | null> {
  if (!updatedBy) return null;
  if (updatedBy === adminId) return 'vous';
  const { data } = await db.from('users').select('email').eq('id', updatedBy).maybeSingle();
  return (data as { email?: string | null } | null)?.email ?? 'un autre administrateur';
}

function toSettings(json: SettingsJson, updatedBy: string | null): RestaurantAlertSettings {
  return {
    minCount: Number(json.pending_lapse_min_count),
    minRate: Number(json.pending_lapse_min_rate),
    trackingSince: json.pending_lapse_tracking_since,
    updatedAt: json.updated_at,
    updatedBy,
  };
}

/** Réglage de la plateforme, sans donnée de client : pas de journal. */
export async function getAlertSettingsAction(): Promise<ActionResult<RestaurantAlertSettings>> {
  const admin = await requireAdmin();
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_restaurant_alert_settings');
  if (error) return dbFailure(error, 'Impossible de charger les seuils d’alerte.');
  if (!data) return { ok: false, code: 'not-found', error: 'Seuils d’alerte introuvables.' };
  const json = data as SettingsJson;
  return { ok: true, data: toSettings(json, await authorLabel(db, admin.id, json.updated_by)) };
}

/**
 * Seuils N (nombre) et X (pourcentage saisi, envoyé en fraction). `expectedUpdatedAt` : la
 * date lue avant la modification, telle que renvoyée par la base.
 */
export async function updateAlertSettingsAction(
  values: unknown,
  expectedUpdatedAt: unknown,
): Promise<ActionResult<RestaurantAlertSettings & { changed: boolean }>> {
  const admin = await requireAdmin();
  const input = (values ?? {}) as { minCount?: unknown; minRatePercent?: unknown };
  const minCount = input.minCount;
  if (typeof minCount !== 'number' || !Number.isInteger(minCount) || minCount < 1 || minCount > 1000) {
    return { ok: false, code: 'invalid-argument', error: 'Nombre de demandes : entier entre 1 et 1000.' };
  }
  const minRate = percentToRate(input.minRatePercent);
  if (minRate === null) {
    return { ok: false, code: 'invalid-argument', error: 'Taux : entre 0 et 100 %, 2 décimales au plus.' };
  }
  if (typeof expectedUpdatedAt !== 'string' || !expectedUpdatedAt) {
    return { ok: false, code: 'conflict', error: ALERT_SETTINGS_CONFLICT_MESSAGE };
  }

  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_update_restaurant_alert_settings', {
    p_pending_lapse_min_count: minCount,
    p_pending_lapse_min_rate: minRate,
    p_expected_updated_at: expectedUpdatedAt,
    p_admin_id: admin.id,
  });
  if (error) {
    if (error.code === 'PT409') return { ok: false, code: 'conflict', error: ALERT_SETTINGS_CONFLICT_MESSAGE };
    return dbFailure(error, 'Modification des seuils impossible.');
  }
  const result = data as { changed: boolean; previous: SettingsJson; current: SettingsJson };
  if (!result.changed) {
    return { ok: true, data: { ...toSettings(result.current, await authorLabel(db, admin.id, result.current.updated_by)), changed: false } };
  }

  const logged = await logAdminAction(admin, {
    action: 'update_restaurant_alert_settings',
    targetType: 'config',
    targetId: SETTINGS_TARGET_ID,
    details: {
      previous: { min_count: Number(result.previous.pending_lapse_min_count), min_rate: Number(result.previous.pending_lapse_min_rate) },
      current: { min_count: Number(result.current.pending_lapse_min_count), min_rate: Number(result.current.pending_lapse_min_rate) },
    },
  });
  if (!logged) {
    // Retour aux valeurs d'avant, conditionné à la version tout juste écrite.
    const { error: revertError } = await db.rpc('admin_update_restaurant_alert_settings', {
      p_pending_lapse_min_count: Number(result.previous.pending_lapse_min_count),
      p_pending_lapse_min_rate: Number(result.previous.pending_lapse_min_rate),
      p_expected_updated_at: result.current.updated_at,
      p_admin_id: admin.id,
    });
    if (revertError) console.error('[alertes] seuils modifiés, non journalisés et non remis :', revertError.code ?? 'erreur');
    return adminLogRefusal(ADMIN_LOG_WRITE_FAILED_MESSAGE);
  }
  return { ok: true, data: { ...toSettings(result.current, 'vous'), changed: true } };
}
