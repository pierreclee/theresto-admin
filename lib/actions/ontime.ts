'use server';

// Suivi de l'engagement OnTime (CGV 7.4 bis), chantier C, lot C5.
// Contrat : docs/features/ontime-tracking.md du dépôt theresto_app (migration
// 20261201110200_ontime_admin.sql). RPC SECURITY DEFINER exécutables par service_role seul :
// appelées avec la clé service, toujours après requireAdmin().
//
// Journal : chaque RPC admin_* écrit ELLE-MÊME sa ligne de platform_logs, dans la même
// transaction que la lecture ou la décision (pas de décision sans journal) : ces actions
// n'appellent donc pas logAdminAction (entrées EXEMPT de actionsLogged.test.ts). Si le journal
// ne s'écrit pas, la RPC échoue entière et l'action renvoie une erreur.
//
// Écritures : une décision peut suspendre un restaurant. En plus de requireAdmin (AAL2, TOTP
// de moins de 2 h), un code TOTP vérifié il y a moins de 5 minutes est exigé (modèle
// updateSubscriptionPlanAction). Concurrence : updated_at lu (p_expected_updated_at) ; la
// base répond { status: 'stale' } si la ligne a changé.

import { createClient, getAdminClient, requireAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/supabase/invokeFunction';
import { hasRecentTotp, MFA_REQUIRED_CODE, RECENT_MFA_REQUIRED_MESSAGE } from '@/lib/utils/recentMfa';
import { ONTIME_PAGE_SIZE, ontimeRefreshedMessage, ontimeStatusMessage, reasonError } from '@/lib/utils/ontime';
import type {
  OntimeDecisionResult,
  OntimeOverview,
  OntimeReport,
  OntimeReportFilter,
  OntimeReportsPage,
  OntimeSanction,
  OntimeSanctionsSwitch,
  OntimeVoidResult,
  OntimeWriteResult,
} from '@/lib/types/ontime';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILTERS: readonly OntimeReportFilter[] = ['open', 'contested', 'upheld', 'dismissed', 'voided', 'withdrawn', 'all'];

type DbError = { code?: string; message?: string } | null;
type Failure = { ok: false; code: string; error: string };
type RpcJson = { status?: string } & Record<string, unknown>;

function dbFailure(error: DbError, fallback: string): Failure {
  // Code seulement : jamais le message brut (en anglais, parfois avec des valeurs).
  console.error('[ontime] refus de la base :', error?.code ?? 'erreur');
  if (error?.code === '22023') {
    // Le message de la base (lu, jamais renvoyé) dit si le refus porte sur le motif.
    const aboutReason = /motif/i.test(error.message ?? '');
    return {
      ok: false,
      code: 'invalid-argument',
      error: aboutReason ? 'Motif invalide : 10 à 1 000 caractères.' : 'Valeurs invalides. Rechargez la page puis réessayez.',
    };
  }
  return { ok: false, code: error?.code ?? 'internal', error: fallback };
}

function statusFailure(status: string | undefined): Failure {
  const code = status === 'stale' ? 'conflict' : status === 'not_found' ? 'not-found' : status === 'invalid_state' ? 'invalid-state' : 'internal';
  return { ok: false, code, error: ontimeStatusMessage(status ?? '') };
}

/** Refus d'une écriture, avec la ligne à jour renvoyée par la RPC (stale, invalid_state). */
function writeFailure(json: RpcJson): Failure & { report?: OntimeReport; sanction?: OntimeSanction } {
  const failure = statusFailure(json.status);
  if (json.status !== 'stale' && json.status !== 'invalid_state') return failure;
  if (!(json.report && typeof json.report === 'object') && !(json.sanction && typeof json.sanction === 'object')) return failure;
  return {
    ...failure,
    error: ontimeRefreshedMessage(json.status),
    ...(json.report && typeof json.report === 'object' ? { report: pickReport(json.report) } : {}),
    ...(json.sanction && typeof json.sanction === 'object' ? { sanction: pickSanction(json.sanction) } : {}),
  };
}

const notFound = (): Failure => ({ ok: false, code: 'not-found', error: 'Introuvable.' });

/** Refus si aucun code TOTP n'a été vérifié il y a moins de 5 minutes (après requireAdmin). */
async function recentTotpRefusal(): Promise<Failure | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (hasRecentTotp(session?.access_token)) return null;
  return { ok: false, code: MFA_REQUIRED_CODE, error: RECENT_MFA_REQUIRED_MESSAGE };
}

// ─── Réponses réduites aux champs du contrat (défense en profondeur) ─────────────

const str = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function pickReport(raw: unknown): OntimeReport {
  const r = (raw ?? {}) as Record<string, unknown>;
  const f = r.booking_facts as Record<string, unknown> | null | undefined;
  return {
    id: String(r.id),
    restaurant_id: String(r.restaurant_id),
    ...(r.restaurant_name !== undefined ? { restaurant_name: str(r.restaurant_name) } : {}),
    booking_id: str(r.booking_id),
    slot_at: String(r.slot_at),
    number_of_guests: num(r.number_of_guests),
    delay_category: String(r.delay_category),
    comment: str(r.comment),
    status: String(r.status),
    reported_at: String(r.reported_at),
    contest_deadline: str(r.contest_deadline),
    contest_paused: r.contest_paused === true,
    contest_remaining_seconds: num(r.contest_remaining_seconds),
    contestable: r.contestable === true,
    contested_at: str(r.contested_at),
    contest_text: str(r.contest_text),
    contest_source: str(r.contest_source),
    decided_at: str(r.decided_at),
    decision_source: str(r.decision_source),
    decision_reason: str(r.decision_reason),
    voided_at: str(r.voided_at),
    void_reason: str(r.void_reason),
    withdrawn_at: str(r.withdrawn_at),
    updated_at: String(r.updated_at),
    reporter_erased: r.reporter_erased === true,
    booking_facts: f
      ? { status: String(f.status), arrived: f.arrived === true, auto_honored: f.auto_honored === true }
      : null,
  };
}

function pickSanction(raw: unknown): OntimeSanction {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(s.id),
    restaurant_id: String(s.restaurant_id),
    kind: String(s.kind),
    created_at: String(s.created_at),
    starts_at: String(s.starts_at),
    ends_at: str(s.ends_at),
    lifted_at: str(s.lifted_at),
    failures_count: num(s.failures_count),
    served_count: num(s.served_count),
    failure_rate: num(s.failure_rate),
    window_start: str(s.window_start),
    window_end: str(s.window_end),
    recidive: s.recidive === true,
    acknowledged_at: str(s.acknowledged_at),
    updated_at: String(s.updated_at),
    trigger_report_id: str(s.trigger_report_id),
    reason: str(s.reason),
    lift_reason: str(s.lift_reason),
    created_by_admin: s.created_by_admin === true,
  };
}

const optionalSanction = (raw: unknown) => (raw && typeof raw === 'object' ? pickSanction(raw) : null);

// ─── Lectures ───────────────────────────────────────────────────────────────

/** Signalements filtrés (contestations : plus anciennes d'abord). Journalisé par la RPC. */
export async function listOntimeReportsAction(
  status: OntimeReportFilter,
  offset = 0,
  restaurantId: string | null = null,
): Promise<ActionResult<OntimeReportsPage>> {
  const admin = await requireAdmin();
  if (!FILTERS.includes(status)) return { ok: false, code: 'invalid-argument', error: 'Filtre inconnu.' };
  if (restaurantId !== null && (typeof restaurantId !== 'string' || !UUID.test(restaurantId))) return notFound();
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_ontime_reports', {
    p_status: status,
    p_restaurant_id: restaurantId,
    p_limit: ONTIME_PAGE_SIZE,
    p_offset: safeOffset,
    p_admin_id: admin.id,
    p_admin_email: admin.email ?? null,
  });
  if (error) return dbFailure(error, 'Impossible de charger les signalements OnTime.');
  const json = (data ?? {}) as RpcJson;
  if (json.status !== 'ok') return statusFailure(json.status);
  const reports = Array.isArray(json.reports) ? json.reports.map(pickReport) : [];
  return { ok: true, data: { reports, total: Number(json.total ?? reports.length) } };
}

/** Contestations à trancher (badge de la barre latérale) : un nombre, sans journal. */
export async function getOntimePendingCountAction(): Promise<ActionResult<number>> {
  await requireAdmin();
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_ontime_pending_count');
  if (error) return dbFailure(error, 'Impossible de compter les contestations.');
  return { ok: true, data: Number(data ?? 0) };
}

/** Section OnTime de la fiche d'un restaurant. Journalisé par la RPC (ontime_overview_viewed). */
export async function getOntimeOverviewAction(restaurantId: string): Promise<ActionResult<OntimeOverview>> {
  const admin = await requireAdmin();
  if (typeof restaurantId !== 'string' || !UUID.test(restaurantId)) return notFound();
  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_ontime_overview', {
    p_restaurant_id: restaurantId,
    p_admin_id: admin.id,
    p_admin_email: admin.email ?? null,
  });
  if (error) return dbFailure(error, 'Impossible de charger le suivi OnTime.');
  const json = (data ?? {}) as RpcJson;
  if (json.status !== 'ok') return statusFailure(json.status);
  const state = (json.state ?? {}) as Record<string, unknown>;
  const win = (json.window ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      state: {
        configured: state.configured === true,
        available: state.available === true,
        suspended_until: str(state.suspended_until),
        withdrawn_at: str(state.withdrawn_at),
        sanctions_enabled: state.sanctions_enabled === true,
      },
      window: {
        failures: Number(win.failures ?? 0),
        served: Number(win.served ?? 0),
        rate: num(win.rate),
        from: String(win.from ?? ''),
        to: String(win.to ?? ''),
        counter_reset_at: str(win.counter_reset_at),
      },
      sanctions: Array.isArray(json.sanctions) ? json.sanctions.map(pickSanction) : [],
      reports: Array.isArray(json.reports) ? json.reports.map(pickReport) : [],
    },
  };
}

/** État de l'interrupteur des sanctions : réglage de la plateforme, sans donnée personnelle (pas de journal). */
export async function getOntimeSanctionsSwitchAction(): Promise<ActionResult<OntimeSanctionsSwitch>> {
  await requireAdmin();
  const db = await getAdminClient();
  const { data, error } = await db
    .from('platform_commission_settings')
    .select('ontime_sanctions_enabled, ontime_sanctions_updated_at, ontime_sanctions_enabled_at')
    .maybeSingle();
  if (error) return dbFailure(error, 'Impossible de lire l’interrupteur des sanctions OnTime.');
  if (!data) return { ok: false, code: 'not-found', error: 'Réglages des commissions introuvables.' };
  const row = data as { ontime_sanctions_enabled: boolean; ontime_sanctions_updated_at: string | null; ontime_sanctions_enabled_at: string | null };
  return {
    ok: true,
    data: {
      enabled: row.ontime_sanctions_enabled === true,
      updatedAt: row.ontime_sanctions_updated_at,
      enabledAt: row.ontime_sanctions_enabled_at,
    },
  };
}

// ─── Écritures (TOTP de moins de 5 minutes) ─────────────────────────────────

/** Tranche une contestation : retenu (manquement, sanctions évaluées) ou écarté. */
export async function decideOntimeReportAction(input: {
  reportId: string;
  decision: 'upheld' | 'dismissed';
  reason: string;
  expectedUpdatedAt: string;
}): Promise<OntimeWriteResult<OntimeDecisionResult>> {
  const admin = await requireAdmin();
  const refusal = await recentTotpRefusal();
  if (refusal) return refusal;
  if (typeof input?.reportId !== 'string' || !UUID.test(input.reportId)) return notFound();
  if (input.decision !== 'upheld' && input.decision !== 'dismissed') {
    return { ok: false, code: 'invalid-argument', error: 'Décision inconnue.' };
  }
  const invalid = reasonError(typeof input.reason === 'string' ? input.reason : '');
  if (invalid) return { ok: false, code: 'invalid-argument', error: invalid };
  if (typeof input.expectedUpdatedAt !== 'string' || !input.expectedUpdatedAt) return statusFailure('stale');

  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_decide_ontime_report', {
    p_report_id: input.reportId,
    p_decision: input.decision,
    p_reason: input.reason.trim(),
    p_expected_updated_at: input.expectedUpdatedAt,
    p_admin_id: admin.id,
    p_admin_email: admin.email ?? null,
  });
  if (error) return dbFailure(error, 'Décision impossible.');
  const json = (data ?? {}) as RpcJson;
  if (json.status !== 'ok') return writeFailure(json);
  return { ok: true, data: { report: pickReport(json.report), sanction: optionalSanction(json.sanction) } };
}

/** Annule un manquement retenu (erreur, fraude) ; la sanction qu'il a déclenchée reste (Q4). */
export async function voidOntimeReportAction(input: {
  reportId: string;
  reason: string;
  expectedUpdatedAt: string;
}): Promise<OntimeWriteResult<OntimeVoidResult>> {
  const admin = await requireAdmin();
  const refusal = await recentTotpRefusal();
  if (refusal) return refusal;
  if (typeof input?.reportId !== 'string' || !UUID.test(input.reportId)) return notFound();
  const invalid = reasonError(typeof input.reason === 'string' ? input.reason : '');
  if (invalid) return { ok: false, code: 'invalid-argument', error: invalid };
  if (typeof input.expectedUpdatedAt !== 'string' || !input.expectedUpdatedAt) return statusFailure('stale');

  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_void_ontime_report', {
    p_report_id: input.reportId,
    p_reason: input.reason.trim(),
    p_expected_updated_at: input.expectedUpdatedAt,
    p_admin_id: admin.id,
    p_admin_email: admin.email ?? null,
  });
  if (error) return dbFailure(error, 'Annulation impossible.');
  const json = (data ?? {}) as RpcJson;
  if (json.status !== 'ok') return writeFailure(json);
  return { ok: true, data: { report: pickReport(json.report), triggeredSanction: optionalSanction(json.triggered_sanction) } };
}

/** Retrait définitif de l'OnTime : décision humaine motivée, permise interrupteur éteint. */
export async function withdrawOntimeAction(input: {
  restaurantId: string;
  reason: string;
}): Promise<ActionResult<{ sanction: OntimeSanction }>> {
  const admin = await requireAdmin();
  const refusal = await recentTotpRefusal();
  if (refusal) return refusal;
  if (typeof input?.restaurantId !== 'string' || !UUID.test(input.restaurantId)) return notFound();
  const invalid = reasonError(typeof input.reason === 'string' ? input.reason : '');
  if (invalid) return { ok: false, code: 'invalid-argument', error: invalid };

  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_withdraw_ontime', {
    p_restaurant_id: input.restaurantId,
    p_reason: input.reason.trim(),
    p_admin_id: admin.id,
    p_admin_email: admin.email ?? null,
  });
  if (error) return dbFailure(error, 'Retrait impossible.');
  const json = (data ?? {}) as RpcJson;
  if (json.status !== 'ok') return statusFailure(json.status);
  return { ok: true, data: { sanction: pickSanction(json.sanction) } };
}

/** Levée anticipée d'une suspension, ou rétablissement après un retrait. */
export async function liftOntimeSanctionAction(input: {
  sanctionId: string;
  reason: string;
  expectedUpdatedAt: string;
}): Promise<OntimeWriteResult<{ sanction: OntimeSanction }>> {
  const admin = await requireAdmin();
  const refusal = await recentTotpRefusal();
  if (refusal) return refusal;
  if (typeof input?.sanctionId !== 'string' || !UUID.test(input.sanctionId)) return notFound();
  const invalid = reasonError(typeof input.reason === 'string' ? input.reason : '');
  if (invalid) return { ok: false, code: 'invalid-argument', error: invalid };
  if (typeof input.expectedUpdatedAt !== 'string' || !input.expectedUpdatedAt) return statusFailure('stale');

  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_lift_ontime_sanction', {
    p_sanction_id: input.sanctionId,
    p_reason: input.reason.trim(),
    p_expected_updated_at: input.expectedUpdatedAt,
    p_admin_id: admin.id,
    p_admin_email: admin.email ?? null,
  });
  if (error) return dbFailure(error, 'Levée impossible.');
  const json = (data ?? {}) as RpcJson;
  if (json.status !== 'ok') return writeFailure(json);
  return { ok: true, data: { sanction: pickSanction(json.sanction) } };
}

/**
 * Interrupteur des sanctions automatiques (Q11). L'allumer exige `confirmCgv: true` : la
 * confirmation explicite que les CGV 1.2 (art. 7.4 bis) sont publiées et en vigueur.
 * `expectedUpdatedAt` : ontime_sanctions_updated_at lu (null au départ).
 */
export async function setOntimeSanctionsAction(input: {
  enabled: boolean;
  expectedUpdatedAt: string | null;
  confirmCgv?: boolean;
}): Promise<ActionResult<OntimeSanctionsSwitch & { previous: boolean }>> {
  const admin = await requireAdmin();
  const refusal = await recentTotpRefusal();
  if (refusal) return refusal;
  if (typeof input?.enabled !== 'boolean') return { ok: false, code: 'invalid-argument', error: 'Valeur invalide.' };
  if (input.enabled && input.confirmCgv !== true) {
    return {
      ok: false,
      code: 'confirmation-required',
      error: 'Confirmez que les CGV 1.2 (article 7.4 bis) sont publiées et en vigueur avant d’allumer les sanctions.',
    };
  }
  if (input.expectedUpdatedAt !== null && typeof input.expectedUpdatedAt !== 'string') return statusFailure('stale');

  const db = await getAdminClient();
  const { data, error } = await db.rpc('admin_set_ontime_sanctions', {
    p_enabled: input.enabled,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_admin_id: admin.id,
    p_admin_email: admin.email ?? null,
  });
  if (error) return dbFailure(error, 'Modification de l’interrupteur impossible.');
  const json = (data ?? {}) as RpcJson;
  if (json.status !== 'ok') {
    if (json.status === 'stale') {
      return { ok: false, code: 'conflict', error: 'L’interrupteur a été modifié entre-temps : vérifiez son nouvel état puis recommencez.' };
    }
    return statusFailure(json.status);
  }
  return {
    ok: true,
    data: {
      previous: json.previous === true,
      enabled: json.enabled === true,
      updatedAt: str(json.updatedAt),
      enabledAt: str(json.enabledAt),
    },
  };
}
