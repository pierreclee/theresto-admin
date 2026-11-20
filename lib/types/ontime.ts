// Suivi de l'engagement OnTime (CGV 7.4 bis), chantier C, lots C4 et C5.
// Contrat : docs/features/ontime-tracking.md du dépôt theresto_app (migration
// 20261201110200_ontime_admin.sql). Aucune identité ni coordonnée du client : le
// commentaire du client et la contestation sont des textes libres, sans compte.

export type OntimeReportStatus = 'open' | 'contested' | 'upheld' | 'dismissed' | 'voided' | 'withdrawn';
export type OntimeReportFilter = OntimeReportStatus | 'all';
export type OntimeDelayCategory = '10_20' | '20_40' | '40_plus' | 'not_served';
export type OntimeSanctionKind = 'warning' | 'suspension' | 'withdrawal';

/** Faits de la réservation enregistrés dans la Plateforme (CGV 7.4 bis (c)) ; null si supprimée. */
export interface OntimeBookingFacts {
  status: string;
  /** Arrivée du client enregistrée par l'équipe. */
  arrived: boolean;
  /** Réputée honorée à la fin du service (passage automatique). */
  auto_honored: boolean;
}

/** Signalement vu par l'admin (ontime_admin_report_json), clés de la base. */
export interface OntimeReport {
  id: string;
  restaurant_id: string;
  /** Liste seulement (admin_ontime_reports). */
  restaurant_name?: string | null;
  booking_id: string | null;
  slot_at: string;
  number_of_guests: number | null;
  delay_category: OntimeDelayCategory | string;
  comment: string | null;
  status: OntimeReportStatus | string;
  reported_at: string;
  contest_deadline: string | null;
  contest_paused: boolean;
  contest_remaining_seconds: number | null;
  contestable: boolean;
  contested_at: string | null;
  contest_text: string | null;
  contest_source: string | null;
  decided_at: string | null;
  decision_source: string | null;
  decision_reason: string | null;
  voided_at: string | null;
  void_reason: string | null;
  withdrawn_at: string | null;
  /** Version lue (contrôle de concurrence des décisions). */
  updated_at: string;
  reporter_erased: boolean;
  booking_facts: OntimeBookingFacts | null;
}

export interface OntimeSanction {
  id: string;
  restaurant_id: string;
  kind: OntimeSanctionKind | string;
  created_at: string;
  starts_at: string;
  ends_at: string | null;
  lifted_at: string | null;
  failures_count: number | null;
  served_count: number | null;
  failure_rate: number | null;
  window_start: string | null;
  window_end: string | null;
  recidive: boolean;
  acknowledged_at: string | null;
  updated_at: string;
  trigger_report_id: string | null;
  /** Motif d'un retrait (TheResto). */
  reason: string | null;
  lift_reason: string | null;
  created_by_admin: boolean;
}

export interface OntimeState {
  /** Réglage du restaurant (accepts_pre_order_timed). */
  configured: boolean;
  available: boolean;
  suspended_until: string | null;
  withdrawn_at: string | null;
  sanctions_enabled: boolean;
}

export interface OntimeWindow {
  failures: number;
  served: number;
  rate: number | null;
  from: string;
  to: string;
  counter_reset_at: string | null;
}

export interface OntimeOverview {
  state: OntimeState;
  window: OntimeWindow;
  sanctions: OntimeSanction[];
  reports: OntimeReport[];
}

export interface OntimeReportsPage {
  reports: OntimeReport[];
  total: number;
}

/** Interrupteur des sanctions automatiques (platform_commission_settings). */
export interface OntimeSanctionsSwitch {
  enabled: boolean;
  /** Version lue (NULL au départ), envoyée telle quelle à admin_set_ontime_sanctions. */
  updatedAt: string | null;
  /** Dernier allumage (plancher du compteur tant que l'interrupteur est allumé). */
  enabledAt: string | null;
}

export interface OntimeDecisionResult {
  report: OntimeReport;
  /** Sanction créée par une décision « retenu » (interrupteur allumé), sinon null. */
  sanction: OntimeSanction | null;
}

export interface OntimeVoidResult {
  report: OntimeReport;
  /** Sanction déclenchée par ce manquement (non levée : Q4), à proposer à la levée. */
  triggeredSanction: OntimeSanction | null;
}

/**
 * Résultat d'une écriture OnTime. Un refus `conflict` (stale) ou `invalid-state` porte la ligne
 * telle qu'elle est en base (signalement ou sanction) : l'écran se met à jour, et un nouvel essai
 * part avec la bonne version.
 */
export type OntimeWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; error: string; report?: OntimeReport; sanction?: OntimeSanction };
