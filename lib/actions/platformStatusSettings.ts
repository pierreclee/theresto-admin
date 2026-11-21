'use server';

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';
import { invokeEdgeFunction, type ActionResult } from '@/lib/supabase/invokeFunction';
import { pendingMaintenanceSegment, type PlatformStatusPeriodRow } from '@/lib/utils/platformStatus';
import type {
  MaintenanceLevel,
  MaintenancePeriod,
  PendingMaintenanceSegment,
  PlatformStatus,
  PlatformStatusInput,
} from '@/lib/types/platformStatus';

// Mode maintenance de la plateforme, via l'Edge Function platform-status-settings (session de
// l'admin, contrat : docs/features/maintenance-mode.md du dépôt theresto_app). Toute
// modification exige côté serveur un code TOTP vérifié il y a moins de 5 min, et la fonction
// refuse (503 audit-log-failed) si son journal d'administration ne s'écrit pas.
// `expectedUpdatedAt` : contrôle de concurrence (409).

const FUNCTION_NAME = 'platform-status-settings';
const MAINTENANCE_PERIODS_LIMIT = 20;

export async function getPlatformStatusAction(): Promise<ActionResult<{ status: PlatformStatus }>> {
  await requireAdmin();
  return invokeEdgeFunction(FUNCTION_NAME, { action: 'getPlatformStatus' });
}

export async function updatePlatformStatusAction(
  input: PlatformStatusInput,
): Promise<ActionResult<{ status: PlatformStatus; auditLogged: boolean }>> {
  await requireAdmin();
  // Saisie complète, champ par champ : rien d'autre n'est transmis à la fonction.
  return invokeEdgeFunction(FUNCTION_NAME, {
    action: 'updatePlatformStatus',
    enabled: input.enabled === true,
    level: input.level,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    message: input.message ?? null,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}

interface PeriodRow {
  id: number;
  level: MaintenanceLevel;
  started_at: string;
  ended_at: string;
}

/**
 * Périodes de maintenance passées (platform_maintenance_periods, lecture par la clé service) :
 * niveau, début et fin réelle, aucune donnée personnelle. Plus la période de la ligne
 * platform_status (`pending`), inscrite seulement à la modification suivante : sans elle, une
 * maintenance en cours ou terminée par sa fin programmée manquerait à l'historique.
 */
export async function getMaintenancePeriodsAction(): Promise<
  ActionResult<{ periods: MaintenancePeriod[]; pending: PendingMaintenanceSegment | null }>
> {
  await requireAdmin();
  const db = await getAdminClient();
  const { data, error } = await db
    .from('platform_maintenance_periods')
    .select('id, level, started_at, ended_at')
    .order('started_at', { ascending: false })
    .limit(MAINTENANCE_PERIODS_LIMIT);
  if (error) {
    console.error('[maintenance] historique illisible', error.code);
    return { ok: false, code: error.code, error: 'Historique des maintenances indisponible.' };
  }
  const periods = ((data ?? []) as PeriodRow[]).map((r) => ({
    id: r.id, level: r.level, startedAt: r.started_at, endedAt: r.ended_at,
  }));
  // Ligne illisible : l'historique inscrit reste affiché, sans la période en cours.
  const { data: row, error: rowError } = await db
    .from('platform_status')
    .select('maintenance_enabled, maintenance_level, starts_at, ends_at, period_floor')
    .eq('id', true)
    .maybeSingle();
  if (rowError) console.error('[maintenance] état illisible pour l historique', rowError.code);
  const pending = rowError ? null : pendingMaintenanceSegment((row ?? null) as PlatformStatusPeriodRow | null);
  return { ok: true, data: { periods, pending } };
}
