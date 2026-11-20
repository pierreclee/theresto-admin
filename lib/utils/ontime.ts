// Libellés et règles d'affichage du suivi OnTime (sans dépendance serveur).
// Contrat : docs/features/ontime-tracking.md du dépôt theresto_app.
import type {
  OntimeReport,
  OntimeReportFilter,
  OntimeSanction,
} from '@/lib/types/ontime';

/** Onglets de la page OnTime (statuts de admin_ontime_reports). */
export const ONTIME_FILTERS: { value: OntimeReportFilter; label: string }[] = [
  { value: 'contested', label: 'À trancher' },
  { value: 'open', label: 'En attente du restaurant' },
  { value: 'upheld', label: 'Retenus' },
  { value: 'dismissed', label: 'Écartés' },
  { value: 'voided', label: 'Annulés' },
  { value: 'withdrawn', label: 'Retirés par le client' },
  { value: 'all', label: 'Tous' },
];

export const ONTIME_STATUS_LABELS: Record<string, string> = {
  open: 'En attente du restaurant',
  contested: 'Contesté, à trancher',
  upheld: 'Manquement retenu',
  dismissed: 'Écarté',
  voided: 'Manquement annulé',
  withdrawn: 'Retiré par le client',
};

export function ontimeStatusLabel(status: string): string {
  return ONTIME_STATUS_LABELS[status] ?? 'Statut inconnu';
}

export function ontimeStatusClasses(status: string): string {
  switch (status) {
    case 'contested':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'upheld':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'open':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export const DELAY_CATEGORY_LABELS: Record<string, string> = {
  '10_20': '10 à 20 min de retard',
  '20_40': '20 à 40 min de retard',
  '40_plus': 'Plus de 40 min de retard',
  not_served: 'Pas servi',
};

export function delayCategoryLabel(category: string): string {
  return DELAY_CATEGORY_LABELS[category] ?? 'Retard déclaré';
}

export const SANCTION_KIND_LABELS: Record<string, string> = {
  warning: 'Avertissement',
  suspension: 'Suspension (14 jours)',
  withdrawal: 'Retrait par TheResto',
};

export function sanctionKindLabel(kind: string): string {
  return SANCTION_KIND_LABELS[kind] ?? 'Sanction';
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  completed: 'Terminée',
  cancelled: 'Annulée',
  refused: 'Refusée',
  noShow: 'No-show',
  changeRequested: 'Nouvel horaire proposé',
  collectingOrders: 'Addition partagée',
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}

export const CONTEST_SOURCE_LABELS: Record<string, string> = {
  team: 'Contestation du restaurant',
  no_show_declared: 'Contestation automatique : no-show déclaré par le restaurant',
};

export function contestSourceLabel(source: string | null): string {
  if (!source) return 'Contestation du restaurant';
  return CONTEST_SOURCE_LABELS[source] ?? 'Contestation du restaurant';
}

/** Bornes des motifs (RPC admin_* : 10 à 1 000 caractères, espaces de bord retirés). */
export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 1000;

/** Message d'erreur d'un motif saisi, ou null s'il est valable. */
export function reasonError(reason: string): string | null {
  const length = reason.trim().length;
  if (length < REASON_MIN_LENGTH) return `Motif trop court : ${REASON_MIN_LENGTH} caractères au moins.`;
  if (length > REASON_MAX_LENGTH) return `Motif trop long : ${REASON_MAX_LENGTH} caractères au plus.`;
  return null;
}

/** Aide de saisie des motifs (contrat §4). */
export const REASON_HINT = 'Montré au restaurant, jamais au client. Pas de nom ni de coordonnées.';

/** Sanction encore en vigueur à [now] : suspension non finie ou retrait, non levés. */
export function isSanctionActive(s: OntimeSanction, now: number = Date.now()): boolean {
  if (s.lifted_at) return false;
  if (new Date(s.starts_at).getTime() > now) return false;
  if (s.kind === 'withdrawal') return true;
  return s.kind === 'suspension' && !!s.ends_at && now < new Date(s.ends_at).getTime();
}

/** Durée restante lisible (« 1 j 4 h », « 35 min ») ; « échue » à 0. */
export function formatRemaining(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  if (seconds <= 0) return 'échue';
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${Math.max(minutes, 1)} min`;
}

/** Faits de la réservation en une phrase. */
export function bookingFactsSummary(report: Pick<OntimeReport, 'booking_facts'>): string {
  const f = report.booking_facts;
  if (!f) return 'Réservation supprimée depuis le signalement.';
  const parts = [bookingStatusLabel(f.status)];
  parts.push(f.arrived ? 'arrivée du client enregistrée' : 'arrivée non enregistrée');
  if (f.auto_honored) parts.push('réputée honorée à la fin du service');
  return parts.join(' · ');
}

/** Message d'un refus de la base selon le statut renvoyé par une RPC admin_*. */
export function ontimeStatusMessage(status: string): string {
  switch (status) {
    case 'stale':
      return 'Ce signalement ou cette sanction a changé entre-temps : rechargez la page et vérifiez avant de recommencer.';
    case 'invalid_state':
      return "Action impossible dans l'état actuel (déjà tranché, sanction finie ou déjà levée, retrait déjà actif). Rechargez la page.";
    case 'not_found':
      return 'Introuvable : il a peut-être été supprimé. Rechargez la page.';
    default:
      return "L'action a échoué.";
  }
}

/** Signalements par page de la liste (la RPC accepte 1 à 200). */
export const ONTIME_PAGE_SIZE = 50;
