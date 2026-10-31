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

const PARIS_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Écart (ms) entre l'heure de Paris et UTC à l'instant donné. */
function parisOffsetMs(instant: number): number {
  const p = Object.fromEntries(PARIS_PARTS.formatToParts(new Date(instant)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
}

/**
 * Minuit à Paris du jour `day` (« AAAA-MM-JJ », valeur d'un <input type="date">), décalé de
 * `addDays` jours. Les filtres « du / au » de l'écran Monitoring sont des jours de Paris.
 * null si la date est invalide.
 */
export function parisDayStart(day: string, addDays = 0): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const wall = Date.UTC(y, mo - 1, d + addDays);
  // Deux passes : l'écart peut changer entre minuit UTC et minuit à Paris (changement d'heure).
  const first = wall - parisOffsetMs(wall);
  return new Date(wall - parisOffsetMs(first));
}
