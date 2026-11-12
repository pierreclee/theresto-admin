'use server';

// Liens courts et QR codes (go.theresto.fr, P10). Tables short_links, short_link_settings et
// link_visit_daily : RLS sans policy, aucun droit pour anon ni authenticated ; lecture et
// écriture avec la clé service, derrière requireAdmin(). Contrat : docs/features/short-links.md
// du dépôt theresto_app.
//
// Écritures : validées ici (mêmes règles que la base, qui fait foi), contrôle de concurrence
// par updated_at, puis journal platform_logs (target_type 'link', slug et noms des champs
// seulement). Journal impossible : l'écriture est annulée (valeurs d'avant remises, lien
// tout juste créé retiré) et l'action refusée (adminLogRefusal). Jamais de suppression d'un
// lien depuis l'écran : un lien imprimé se désactive.
//
// Lectures : liens et compteurs agrégés (jour, plateforme, pays, attributs du lien), aucune
// donnée personnelle : pas de journal (D1).

import { getAdminClient, getServerEnvironment, requireAdmin } from '@/lib/supabase/server';
import { adminLogRefusal, logAdminAction, type AdminLogEntry } from '@/lib/audit/adminLog';
import { ADMIN_LOG_WRITE_FAILED_MESSAGE } from '@/lib/audit/messages';
import type { ActionResult } from '@/lib/supabase/invokeFunction';
import {
  changedFields,
  SHORT_LINK_CONFLICT_MESSAGE,
  shortLinkDbErrorMessage,
  shortLinkDomain,
  validateShortLinkInput,
  validateShortLinkSettingsInput,
  type ShortLinkColumns,
  type ShortLinkSettingsColumns,
} from '@/lib/links/shortLinkRules';
import {
  aggregateLinkStats,
  aggregateOverview,
  hitsByLink,
  isStatsPeriod,
  LINK_VISIT_COLUMNS,
  linkStatsCsv,
  parisDay,
  periodStart,
  type LinkVisitRow,
  type StatsPeriod,
} from '@/lib/links/linkStats';
import type {
  ShortLink,
  ShortLinkDetail,
  ShortLinkSettings,
  ShortLinksOverviewResult,
  ShortLinksPage,
  ShortLinkStatsResult,
} from '@/lib/types/shortLinks';

// Une seule chaîne littérale : supabase-js en déduit le type des lignes.
const LINK_COLUMNS = 'id, slug, label, kind, target_default, target_ios, target_android, forward_params, src, ville, persona, campaign, active, expires_at, created_at, updated_at';
const SETTINGS_COLUMNS = 'app_store_url, play_store_url, app_store_provider_token, updated_at, updated_by';
const SETTINGS_TARGET_ID = 'short_link_settings';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** PostgREST plafonne une réponse à 1000 lignes : lecture par pages. */
const VISIT_PAGE_SIZE = 1000;
const VISIT_MAX_PAGES = 100;

type ShortLinkRow = ShortLinkColumns & {
  id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};
type SettingsRow = ShortLinkSettingsColumns & { updated_at: string; updated_by: string | null };
type Db = Awaited<ReturnType<typeof getAdminClient>>;
type DbError = { code?: string; message?: string } | null;

function toShortLink(row: ShortLinkRow): ShortLink {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    kind: row.kind,
    targetDefault: row.target_default,
    targetIos: row.target_ios,
    targetAndroid: row.target_android,
    forwardParams: row.forward_params,
    src: row.src,
    ville: row.ville,
    persona: row.persona,
    campaign: row.campaign,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSettings(row: SettingsRow): ShortLinkSettings {
  return {
    appStoreUrl: row.app_store_url,
    playStoreUrl: row.play_store_url,
    appStoreProviderToken: row.app_store_provider_token,
    updatedAt: row.updated_at,
  };
}

function dbFailure(error: DbError): { ok: false; code: string; error: string } {
  console.error('[liens] refus de la base :', error?.code ?? 'erreur');
  return { ok: false, code: error?.code ?? 'internal', error: shortLinkDbErrorMessage(error) };
}

const invalid = (error: string) => ({ ok: false as const, code: 'invalid-argument', error });
const conflict = () => ({ ok: false as const, code: 'conflict', error: SHORT_LINK_CONFLICT_MESSAGE });
const notFound = () => ({ ok: false as const, code: 'not-found', error: 'Lien introuvable.' });

async function readLinkRow(db: Db, id: string): Promise<{ row: ShortLinkRow | null; error: DbError }> {
  const { data, error } = await db.from('short_links').select(LINK_COLUMNS).eq('id', id).maybeSingle();
  return { row: (data as ShortLinkRow | null) ?? null, error };
}

/** Lignes de link_visit_daily depuis `start` (jour de Paris inclus), d'un lien ou de tous. */
async function readVisitRows(
  db: Db,
  start: string,
  linkId?: string,
): Promise<{ rows: LinkVisitRow[]; truncated: boolean; error: DbError }> {
  const rows: LinkVisitRow[] = [];
  for (let page = 0; page < VISIT_MAX_PAGES; page += 1) {
    let query = db.from('link_visit_daily').select(LINK_VISIT_COLUMNS).gte('day', start);
    if (linkId) query = query.eq('link_id', linkId);
    // Tri sur la clé unique : pages stables.
    const { data, error } = await query
      .order('day').order('link_id', { nullsFirst: true }).order('platform').order('country')
      .order('src').order('ville').order('persona')
      .range(page * VISIT_PAGE_SIZE, (page + 1) * VISIT_PAGE_SIZE - 1);
    if (error) return { rows, truncated: false, error };
    const batch = (data ?? []) as LinkVisitRow[];
    rows.push(...batch);
    if (batch.length < VISIT_PAGE_SIZE) return { rows, truncated: false, error: null };
  }
  return { rows, truncated: true, error: null };
}

// ─── Lectures ───────────────────────────────────────────────────────────────

export async function listShortLinksAction(): Promise<ActionResult<ShortLinksPage>> {
  await requireAdmin();
  const db = await getAdminClient();
  const domain = shortLinkDomain(await getServerEnvironment());
  const [links, settings, visits] = await Promise.all([
    db.from('short_links').select(LINK_COLUMNS).order('created_at', { ascending: false }),
    db.from('short_link_settings').select(SETTINGS_COLUMNS).eq('id', true).maybeSingle(),
    readVisitRows(db, periodStart(30)),
  ]);
  if (links.error) return dbFailure(links.error);
  if (settings.error) return dbFailure(settings.error);
  if (visits.error) return dbFailure(visits.error);
  const scans = hitsByLink(visits.rows);
  return {
    ok: true,
    data: {
      links: ((links.data ?? []) as ShortLinkRow[]).map((row) => ({ ...toShortLink(row), scans30d: scans.get(row.id) ?? 0 })),
      settings: settings.data ? toSettings(settings.data as SettingsRow) : null,
      domain,
      unknownScans30d: scans.get('') ?? 0,
      truncated: visits.truncated,
    },
  };
}

export async function getShortLinkAction(id: string): Promise<ActionResult<ShortLinkDetail>> {
  await requireAdmin();
  if (typeof id !== 'string' || !UUID.test(id)) return notFound();
  const db = await getAdminClient();
  const { row, error } = await readLinkRow(db, id);
  if (error) return dbFailure(error);
  if (!row) return notFound();
  return { ok: true, data: { link: toShortLink(row), domain: shortLinkDomain(await getServerEnvironment()) } };
}

export async function getShortLinkStatsAction(id: string, days: StatsPeriod): Promise<ActionResult<ShortLinkStatsResult>> {
  await requireAdmin();
  if (typeof id !== 'string' || !UUID.test(id)) return notFound();
  if (!isStatsPeriod(days)) return invalid('Période : 30 ou 90 jours.');
  const db = await getAdminClient();
  const start = periodStart(days);
  const end = parisDay(new Date());
  const { rows, truncated, error } = await readVisitRows(db, start, id);
  if (error) return dbFailure(error);
  return { ok: true, data: { days, start, end, stats: aggregateLinkStats(rows, start, end), truncated } };
}

export async function getShortLinksOverviewAction(days: StatsPeriod): Promise<ActionResult<ShortLinksOverviewResult>> {
  await requireAdmin();
  if (!isStatsPeriod(days)) return invalid('Période : 30 ou 90 jours.');
  const db = await getAdminClient();
  const start = periodStart(days);
  const end = parisDay(new Date());
  const [visits, links] = await Promise.all([
    readVisitRows(db, start),
    db.from('short_links').select('id, campaign'),
  ]);
  if (visits.error) return dbFailure(visits.error);
  if (links.error) return dbFailure(links.error);
  const campaigns = new Map(((links.data ?? []) as { id: string; campaign: string | null }[]).map((l) => [l.id, l.campaign]));
  return {
    ok: true,
    data: { days, start, end, overview: aggregateOverview(visits.rows, campaigns), truncated: visits.truncated },
  };
}

/** CSV des agrégats (jour, slug, plateforme, pays, attributs, scans, robots) d'un lien ou de tous. */
export async function exportShortLinkStatsCsvAction(input: {
  linkId: string | null;
  days: StatsPeriod;
}): Promise<ActionResult<{ filename: string; csv: string; truncated: boolean }>> {
  await requireAdmin();
  if (!isStatsPeriod(input?.days)) return invalid('Période : 30 ou 90 jours.');
  if (input.linkId !== null && (typeof input.linkId !== 'string' || !UUID.test(input.linkId))) return notFound();
  const db = await getAdminClient();
  const start = periodStart(input.days);
  const [visits, links] = await Promise.all([
    readVisitRows(db, start, input.linkId ?? undefined),
    db.from('short_links').select('id, slug'),
  ]);
  if (visits.error) return dbFailure(visits.error);
  if (links.error) return dbFailure(links.error);
  const slugs = new Map(((links.data ?? []) as { id: string; slug: string }[]).map((l) => [l.id, l.slug]));
  const scope = input.linkId ? slugs.get(input.linkId) ?? 'lien' : 'tous-les-liens';
  return {
    ok: true,
    data: {
      filename: `scans-${scope}-${start}-${parisDay(new Date())}.csv`,
      csv: linkStatsCsv(visits.rows, slugs),
      truncated: visits.truncated,
    },
  };
}

// ─── Écritures ──────────────────────────────────────────────────────────────

export async function createShortLinkAction(input: unknown): Promise<ActionResult<ShortLink>> {
  const admin = await requireAdmin();
  const parsed = validateShortLinkInput(input);
  if (!parsed.ok) return invalid(parsed.error);
  const values = parsed.value;
  const db = await getAdminClient();
  const { data, error } = await db.from('short_links')
    .insert({ ...values, created_by: admin.id })
    .select(LINK_COLUMNS)
    .single();
  if (error || !data) return dbFailure(error);
  const row = data as ShortLinkRow;

  const logged = await logAdminAction(admin, {
    action: 'create_short_link',
    targetType: 'link',
    targetId: row.id,
    details: {
      slug: row.slug,
      fields: (Object.keys(values) as (keyof ShortLinkColumns)[]).filter((k) => values[k] !== null),
    },
  });
  if (!logged) {
    // Lien tout juste créé, encore jamais imprimé : retiré, pour ne rien garder sans trace.
    const { error: revertError } = await db.from('short_links').delete().eq('id', row.id);
    if (revertError) console.error('[liens] création non journalisée et non annulée :', row.id);
    return adminLogRefusal(ADMIN_LOG_WRITE_FAILED_MESSAGE);
  }
  return { ok: true, data: toShortLink(row) };
}

/**
 * Écrit `values` si la ligne n'a pas changé depuis `expectedUpdatedAt`, journalise par `log`
 * (logAdminAction de l'action appelante), et remet les valeurs d'avant si le journal échoue.
 */
async function guardedLinkUpdate(
  log: (entry: AdminLogEntry) => Promise<boolean>,
  id: string,
  expectedUpdatedAt: unknown,
  next: (current: ShortLinkRow) => Partial<ShortLinkRow> | { error: string },
  logEntry: (current: ShortLinkRow, updated: ShortLinkRow, fields: string[]) => { action: string; details: Record<string, unknown> },
): Promise<ActionResult<ShortLink>> {
  if (typeof id !== 'string' || !UUID.test(id)) return notFound();
  if (typeof expectedUpdatedAt !== 'string' || !expectedUpdatedAt) return conflict();
  const db = await getAdminClient();
  const { row: current, error: readError } = await readLinkRow(db, id);
  if (readError) return dbFailure(readError);
  if (!current) return notFound();
  if (new Date(current.updated_at).getTime() !== new Date(expectedUpdatedAt).getTime()) return conflict();

  const target = next(current);
  if ('error' in target) return invalid(target.error as string);
  const fields = changedFields(current, target as ShortLinkRow);
  if (fields.length === 0) return { ok: true, data: toShortLink(current) };
  const changes = Object.fromEntries(fields.map((f) => [f, (target as Record<string, unknown>)[f]]));

  // Filtre sur la date attendue : une modification concurrente fait échouer celle-ci.
  const { data, error } = await db.from('short_links')
    .update(changes).eq('id', id).eq('updated_at', expectedUpdatedAt)
    .select(LINK_COLUMNS).maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return conflict();
  const updated = data as ShortLinkRow;

  const entry = logEntry(current, updated, fields);
  const logged = await log({ ...entry, targetType: 'link', targetId: id });
  if (!logged) {
    const previous = Object.fromEntries(fields.map((f) => [f, (current as unknown as Record<string, unknown>)[f]]));
    const { data: reverted } = await db.from('short_links')
      .update(previous).eq('id', id).eq('updated_at', updated.updated_at).select('id').maybeSingle();
    if (!reverted) console.error('[liens] modification non journalisée et non annulée :', id);
    return adminLogRefusal(ADMIN_LOG_WRITE_FAILED_MESSAGE);
  }
  return { ok: true, data: toShortLink(updated) };
}

/** Modification complète d'un lien (saisie entière, comme à la création). */
export async function updateShortLinkAction(
  id: string,
  input: unknown,
  expectedUpdatedAt: string,
): Promise<ActionResult<ShortLink>> {
  const admin = await requireAdmin();
  const parsed = validateShortLinkInput(input);
  if (!parsed.ok) return invalid(parsed.error);
  const log = (entry: AdminLogEntry) => logAdminAction(admin, entry);
  return guardedLinkUpdate(log, id, expectedUpdatedAt, () => parsed.value, (current, updated, fields) => ({
    action: 'update_short_link',
    details: {
      slug: updated.slug,
      ...(current.slug !== updated.slug ? { previousSlug: current.slug } : {}),
      fields,
    },
  }));
}

/** Désactivation ou réactivation ; jamais de suppression (un lien imprimé reste compté). */
export async function setShortLinkActiveAction(
  id: string,
  active: boolean,
  expectedUpdatedAt: string,
): Promise<ActionResult<ShortLink>> {
  const admin = await requireAdmin();
  if (typeof active !== 'boolean') return invalid('Valeur invalide.');
  const log = (entry: AdminLogEntry) => logAdminAction(admin, entry);
  return guardedLinkUpdate(log, id, expectedUpdatedAt, () => ({ active }), (_current, updated) => ({
    action: active ? 'reactivate_short_link' : 'deactivate_short_link',
    details: { slug: updated.slug },
  }));
}

/** Liens des stores (App Store, Google Play) et provider token App Store, pour tous les liens « download ». */
export async function updateShortLinkSettingsAction(
  input: unknown,
  expectedUpdatedAt: string,
): Promise<ActionResult<ShortLinkSettings>> {
  const admin = await requireAdmin();
  const parsed = validateShortLinkSettingsInput(input);
  if (!parsed.ok) return invalid(parsed.error);
  if (typeof expectedUpdatedAt !== 'string' || !expectedUpdatedAt) return conflict();
  const db = await getAdminClient();
  const { data: currentData, error: readError } = await db.from('short_link_settings')
    .select(SETTINGS_COLUMNS).eq('id', true).maybeSingle();
  if (readError) return dbFailure(readError);
  if (!currentData) return { ok: false, code: 'not-found', error: 'Réglages des liens introuvables.' };
  const current = currentData as SettingsRow;
  if (new Date(current.updated_at).getTime() !== new Date(expectedUpdatedAt).getTime()) return conflict();

  const fields = changedFields(current, parsed.value);
  if (fields.length === 0) return { ok: true, data: toSettings(current) };
  const changes = Object.fromEntries(fields.map((f) => [f, parsed.value[f]]));
  const { data, error } = await db.from('short_link_settings')
    .update({ ...changes, updated_by: admin.id }).eq('id', true).eq('updated_at', expectedUpdatedAt)
    .select(SETTINGS_COLUMNS).maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return conflict();
  const updated = data as SettingsRow;

  const logged = await logAdminAction(admin, {
    action: 'update_short_link_settings',
    targetType: 'link',
    targetId: SETTINGS_TARGET_ID,
    details: { fields },
  });
  if (!logged) {
    const previous = { ...Object.fromEntries(fields.map((f) => [f, current[f]])), updated_by: current.updated_by };
    const { data: reverted } = await db.from('short_link_settings')
      .update(previous).eq('id', true).eq('updated_at', updated.updated_at).select('updated_at').maybeSingle();
    if (!reverted) console.error('[liens] réglages modifiés sans journal et non remis');
    return adminLogRefusal(ADMIN_LOG_WRITE_FAILED_MESSAGE);
  }
  return { ok: true, data: toSettings(updated) };
}
