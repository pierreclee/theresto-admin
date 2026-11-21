// Règles de saisie et d'affichage du mode maintenance, reprises de l'Edge Function
// platform-status-settings (_shared/platform-status-settings.ts et _shared/platform-maintenance.ts
// du dépôt theresto_app), qui font foi. Heures saisies et affichées à l'heure de Paris.

import type {
  MaintenanceLevel,
  PlatformStatus,
  PlatformStatusInput,
} from '@/lib/types/platformStatus';

export const MAX_MAINTENANCE_MESSAGE_LENGTH = 300;
/** Délai de l'annonce dans les apps (CGV 9.2), même valeur que platform_status(). */
export const ANNOUNCE_HOURS = 48;
const HOUR_MS = 3600 * 1000;
const PARIS = 'Europe/Paris';

export const LEVEL_INFO: Record<MaintenanceLevel, { label: string; description: string }> = {
  clients: {
    label: 'Clients',
    description:
      'L’App et le widget affichent l’écran de maintenance : réservations, paiements et invitations des clients '
      + 'sont refusés. Le Hub et l’espace employé restent ouverts, avec un bandeau.',
  },
  all: {
    label: 'Tout',
    description:
      'Clients et restaurants : l’App, le widget, le Hub, l’espace employé, la cuisine, le bar et le service '
      + 'affichent l’écran de maintenance ; toutes les écritures sont refusées (les admins restent exemptés).',
  },
};

export const ALL_LEVEL_CONFIRMATION =
  'Je confirme fermer aussi le Hub et l’espace employé (cuisine, bar, service) de tous les restaurants.';

// ─── Heure de Paris ──────────────────────────────────────────────────────────

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: PARIS, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function parisParts(time: number): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const p of PARTS_FORMAT.formatToParts(new Date(time))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts;
}

/** Décalage de Paris sur UTC à cet instant, en millisecondes (+1 h l'hiver, +2 h l'été). */
function parisOffset(time: number): number {
  const p = parisParts(time);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(time / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Instant ISO → valeur d'un champ datetime-local, à l'heure de Paris (« 2026-12-02T02:00 »). */
export function toParisInput(iso: string | null): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const p = parisParts(time);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Valeur d'un champ datetime-local (heure de Paris) → instant ISO en UTC ; null si illisible. */
export function parisInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Deux passes : le décalage dépend de l'instant cherché (changement d'heure).
  const first = wall - parisOffset(wall);
  const time = wall - parisOffset(first);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Date et heure à l'heure de Paris, pour l'écran (« 2 déc. 2026, 02:00 »). */
export function formatParis(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: PARIS, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Durée lisible (« 2 h 30 », « 45 min »). */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${pad(rest)}` : `${hours} h`;
}

// ─── État ────────────────────────────────────────────────────────────────────

/**
 * - disabled : aucune maintenance réglée ;
 * - scheduled : programmée, début dans plus de 48 h (pas encore montrée aux apps) ;
 * - announced : début dans 48 h au plus, bandeau d'annonce dans les apps ;
 * - active : en vigueur ;
 * - ended : fin automatique atteinte (le réglage reste activé, sans effet).
 */
export type MaintenancePhase = 'disabled' | 'scheduled' | 'announced' | 'active' | 'ended';

/** Même calcul que maintenanceLevelOf et toStatusResponse de l'Edge Function, à l'instant [now]. */
export function maintenancePhase(
  status: Pick<PlatformStatus, 'enabled' | 'startsAt' | 'endsAt'>,
  now: Date,
): MaintenancePhase {
  if (!status.enabled || !status.startsAt) return 'disabled';
  const starts = Date.parse(status.startsAt);
  if (Number.isNaN(starts)) return 'disabled';
  const ends = status.endsAt ? Date.parse(status.endsAt) : NaN;
  if (!Number.isNaN(ends) && now.getTime() >= ends) return 'ended';
  if (starts <= now.getTime()) return 'active';
  return starts - now.getTime() <= ANNOUNCE_HOURS * HOUR_MS ? 'announced' : 'scheduled';
}

export const PHASE_LABELS: Record<MaintenancePhase, string> = {
  disabled: 'Désactivée',
  scheduled: 'Programmée',
  announced: 'Annoncée',
  active: 'En cours',
  ended: 'Terminée',
};

/** Ce que voient les apps avant le début (bandeau d'annonce de 48 h, CGV 9.2). */
export function announcementText(startsAtIso: string, now: Date): string {
  const starts = Date.parse(startsAtIso);
  const lead = starts - now.getTime();
  if (lead <= 0) {
    return 'Début immédiat, sans préavis (intervention urgente, permise par la CGV 9.2) : aucun bandeau d’annonce.';
  }
  if (lead <= ANNOUNCE_HOURS * HOUR_MS) {
    return 'Bandeau « Maintenance prévue le … » affiché dès l’enregistrement sur l’App, le Hub et le widget, jusqu’au début.';
  }
  return `Bandeau « Maintenance prévue le … » affiché à partir du ${formatParis(new Date(starts - ANNOUNCE_HOURS * HOUR_MS).toISOString())}`
    + ' (48 h avant le début), jusqu’au début.';
}

// ─── Saisie ──────────────────────────────────────────────────────────────────

export interface MaintenanceDraft {
  level: MaintenanceLevel;
  startMode: 'now' | 'scheduled';
  /** Champ datetime-local, heure de Paris. */
  startsAt: string;
  endMode: 'none' | 'scheduled';
  endsAt: string;
  message: string;
}

/** Saisie de départ : la maintenance en place si elle n'est pas terminée, sinon une nouvelle. */
export function draftFromStatus(status: PlatformStatus, now: Date): MaintenanceDraft {
  const phase = maintenancePhase(status, now);
  const current = phase !== 'disabled' && phase !== 'ended';
  return {
    level: status.level,
    startMode: current ? 'scheduled' : 'now',
    startsAt: current ? toParisInput(status.startsAt) : '',
    endMode: current && status.endsAt ? 'scheduled' : 'none',
    endsAt: current ? toParisInput(status.endsAt) : '',
    message: current ? status.message ?? '' : '',
  };
}

/** Marge pour un début programmé « tout juste passé » (saisie à la minute). */
const PAST_START_TOLERANCE_MS = 60 * 1000;

/**
 * Saisie de l'écran → corps de updatePlatformStatus (enabled: true), ou erreur en français.
 * « Maintenant » prend l'heure de [now] : à rappeler juste avant l'envoi.
 */
export function parseMaintenanceDraft(
  draft: MaintenanceDraft,
  status: PlatformStatus,
  now: Date,
): { ok: true; value: PlatformStatusInput } | { ok: false; error: string } {
  let startsAt: string;
  if (draft.startMode === 'now') {
    startsAt = now.toISOString();
  } else {
    const parsed = parisInputToIso(draft.startsAt);
    if (!parsed) return { ok: false, error: 'Début : date et heure attendues.' };
    const phase = maintenancePhase(status, now);
    const unchanged = (phase === 'active' || phase === 'announced' || phase === 'scheduled')
      && status.startsAt !== null && draft.startsAt === toParisInput(status.startsAt);
    if (unchanged) {
      // Début inchangé (prolongation, changement de message…) : valeur exacte du serveur.
      startsAt = status.startsAt as string;
    } else {
      if (Date.parse(parsed) < now.getTime() - PAST_START_TOLERANCE_MS) {
        return { ok: false, error: 'Début déjà passé : choisissez « Maintenant » ou une date à venir.' };
      }
      startsAt = parsed;
    }
  }

  let endsAt: string | null = null;
  if (draft.endMode === 'scheduled') {
    endsAt = parisInputToIso(draft.endsAt);
    if (!endsAt) return { ok: false, error: 'Fin : date et heure attendues.' };
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: 'La fin doit être après le début.' };
    if (Date.parse(endsAt) <= now.getTime()) return { ok: false, error: 'La fin est déjà passée.' };
  }

  const trimmed = draft.message.trim();
  if (trimmed.length > MAX_MAINTENANCE_MESSAGE_LENGTH) {
    return { ok: false, error: `Message : ${MAX_MAINTENANCE_MESSAGE_LENGTH} caractères au plus.` };
  }

  return {
    ok: true,
    value: {
      enabled: true,
      level: draft.level,
      startsAt,
      endsAt,
      message: trimmed === '' ? null : trimmed,
      expectedUpdatedAt: status.updatedAt,
    },
  };
}

/** « Terminer maintenant » / « Annuler » : désactivation, niveau, dates et message gardés. */
export function disableInput(status: PlatformStatus): PlatformStatusInput {
  return {
    enabled: false,
    level: status.level,
    startsAt: status.startsAt,
    endsAt: status.endsAt,
    message: status.message,
    expectedUpdatedAt: status.updatedAt,
  };
}

// ─── Erreurs ─────────────────────────────────────────────────────────────────

export const PLATFORM_STATUS_CONFLICT_MESSAGE =
  'L’état de la maintenance a changé entre-temps : il a été rechargé, vérifiez-le puis recommencez.';

/** Messages 400 de l'Edge Function (en anglais) → français. */
const INVALID_ARGUMENT_MESSAGES: Record<string, string> = {
  'endsAt must be in the future when enabled': 'La fin est déjà passée : choisissez une fin à venir.',
  'endsAt must be after startsAt': 'La fin doit être après le début.',
  'startsAt is required when enabled': 'Le début est obligatoire.',
  [`message must be at most ${MAX_MAINTENANCE_MESSAGE_LENGTH} characters`]:
    `Message : ${MAX_MAINTENANCE_MESSAGE_LENGTH} caractères au plus.`,
};

/** Erreur de l'Edge Function → message en français pour l'admin. */
export function platformStatusErrorMessage(code: string | undefined, serverMessage?: string): string {
  switch (code) {
    case 'unauthenticated':
      return 'Session expirée. Reconnectez-vous puis recommencez.';
    case 'permission-denied':
      return 'Vérification en deux étapes de plus de 5 minutes, ou droits insuffisants. Saisissez un nouveau code.';
    case 'conflict':
    case 'failed-precondition':
      return PLATFORM_STATUS_CONFLICT_MESSAGE;
    case 'invalid-argument':
      return (serverMessage && INVALID_ARGUMENT_MESSAGES[serverMessage])
        ?? 'Valeurs refusées par le serveur : vérifiez le niveau, les dates et le message.';
    case 'not-found':
      return 'Réglage de la maintenance introuvable sur le serveur.';
    case 'audit-log-failed':
      return "Modification annulée : le journal d'administration n'a pas pu être écrit. Rien n'a changé, réessayez.";
    default:
      return 'La modification a échoué. Réessayez.';
  }
}

/** Code d'erreur qui impose de repartir des valeurs du serveur. */
export const isConflict = (code: string | undefined) => code === 'conflict' || code === 'failed-precondition';

export const PLATFORM_STATUS_NETWORK_MESSAGE =
  'Connexion au serveur impossible : vérifiez votre connexion internet, puis réessayez.';

/**
 * Échec du réseau (navigateur hors ligne, serveur injoignable) : messages bruts du navigateur,
 * de fetch ou du client Supabase (« Failed to fetch », « fetch failed », « Load failed »…).
 */
export function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|connection closed/i
    .test(error.message);
}
