import type { AuditLog } from '@/lib/types/audit';

// Ligne de platform_logs (schéma du lot 9 : event_type, actor_id et ip_address supprimées).
export interface PlatformLogRow {
  id: string;
  action: string;
  performed_by: string | null;
  performed_by_email: string | null;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const PLATFORM_LOG_COLUMNS =
  'id, action, performed_by, performed_by_email, target_type, target_id, details, created_at';

/** Ligne de platform_logs → AuditLog de l'écran Monitoring. Une action *_failed est un échec. */
export function toAuditLog(row: PlatformLogRow): AuditLog {
  return {
    id: row.id,
    adminId: row.performed_by ?? '',
    adminEmail: row.performed_by_email ?? undefined,
    action: row.action,
    resourceType: row.target_type ?? '',
    resourceId: row.target_id ?? undefined,
    changes: row.details ?? undefined,
    timestamp: new Date(row.created_at),
    success: !row.action.endsWith('_failed'),
  };
}

/** Fin exclusive d'un filtre « au <jour> » : le lendemain à la même heure. */
export function dayAfter(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}
