// Mode maintenance de la plateforme, lu et écrit par l'Edge Function platform-status-settings
// du dépôt theresto_app (docs/features/maintenance-mode.md).

export type MaintenanceLevel = 'clients' | 'all';

/** Réponse de getPlatformStatus : réglage enregistré et ce que voient les apps à cet instant. */
export interface PlatformStatus {
  enabled: boolean;
  level: MaintenanceLevel;
  startsAt: string | null;
  endsAt: string | null;
  message: string | null;
  /** Maintenance en vigueur pour les apps. */
  active: boolean;
  /** Bandeau d'annonce affiché (début dans moins de 48 h). */
  announced: boolean;
  updatedAt: string;
}

/** Saisie complète de updatePlatformStatus (null pour retirer, jamais absent). */
export interface PlatformStatusInput {
  enabled: boolean;
  level: MaintenanceLevel;
  startsAt: string | null;
  endsAt: string | null;
  message: string | null;
  expectedUpdatedAt: string;
}

/**
 * Période de la ligne platform_status, pas encore inscrite dans platform_maintenance_periods
 * (elle ne l'est qu'à la modification suivante) : début réel (jamais avant la dernière
 * modification, period_floor) et fin programmée (null : jusqu'à la désactivation). Elle peut
 * être à venir, en cours ou terminée par sa fin programmée : à situer à l'écran avec l'heure.
 */
export interface PendingMaintenanceSegment {
  level: MaintenanceLevel;
  startedAt: string;
  plannedEndAt: string | null;
}

/** Période de maintenance réellement passée (platform_maintenance_periods). */
export interface MaintenancePeriod {
  id: number;
  level: MaintenanceLevel;
  startedAt: string;
  endedAt: string;
}
