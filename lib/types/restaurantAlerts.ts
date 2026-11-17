// Alertes des restaurants et suivi des demandes non confirmées (chantier B, lot B6).
// Contrat : docs/features/admin-restaurant-alerts.md du dépôt theresto_app. Aucune donnée
// de client : ni nom, ni contact, ni identifiant de réservation.

export type AlertSeverity = 'critical' | 'warning' | 'info';

/** Une ligne de admin_restaurant_alerts (un type d'alerte d'un restaurant). */
export interface RestaurantAlert {
  restaurantId: string;
  /** Nom commercial du restaurant (restaurants.name). */
  restaurantName: string | null;
  /** Type d'alerte ; un type inconnu (chantier C : ontime_*) s'affiche avec un libellé générique. */
  kind: string;
  severity: AlertSeverity | string;
  since: string | null;
  /** Chiffres propres au type, jamais de donnée personnelle. */
  metrics: Record<string, unknown>;
}

export interface RestaurantAlertsResult {
  alerts: RestaurantAlert[];
  /** Alertes avant pagination. */
  total: number;
  /** Restaurants distincts en alerte. */
  totalRestaurants: number;
}

/** Une ligne de admin_pending_lapse_stats. */
export interface PendingLapseStat {
  restaurantId: string;
  lapsed30d: number;
  total30d: number;
  rate30d: number | null;
  lapsedPrev30d: number;
  totalPrev30d: number;
  ratePrev30d: number | null;
  lastLapseAt: string | null;
  alert: boolean;
}

export interface PendingLapseStatsResult {
  stats: PendingLapseStat[];
  total: number;
}

export interface PendingLapseWeek {
  period_start: string;
  period_end: string;
  lapsed: number;
  total: number;
  rate: number | null;
  /** false : semaine (au moins en partie) antérieure au début du suivi. */
  tracked: boolean;
}

/** Une demande fermée sans réponse : aucune donnée du client, aucun identifiant. */
export interface PendingLapseClosure {
  booking_date: string;
  booking_time: string | null;
  number_of_guests: number | null;
  booking_source: string | null;
  reservation_type: string | null;
  previous_status: string;
  service_end_at: string;
  closed_at: string;
}

/** Réponse de admin_restaurant_pending_lapses (jsonb, clés de la base). */
export interface PendingLapseDetail {
  restaurant_id: string;
  computed_at: string;
  settings: {
    pending_lapse_min_count: number;
    pending_lapse_min_rate: number;
    pending_lapse_tracking_since: string;
  };
  current: { lapsed: number; total: number; rate: number | null; last_lapse_at: string | null; alert: boolean };
  previous: { lapsed: number; total: number; rate: number | null };
  trend: PendingLapseWeek[];
  closures: { days: number; total: number; limit: number; offset: number; items: PendingLapseClosure[] };
}

/** Seuils d'alerte (restaurant_alert_settings), taux en fraction (0.1 = 10 %). */
export interface RestaurantAlertSettings {
  minCount: number;
  minRate: number;
  trackingSince: string;
  updatedAt: string;
  /** Auteur de la dernière modification : « vous », son e-mail d'admin, ou null (jamais modifié / compte supprimé). */
  updatedBy: string | null;
}

/** Saisie de l'écran : N et X en pourcentage (10 = 10 %). */
export interface RestaurantAlertSettingsInput {
  minCount: number;
  minRatePercent: number;
}
