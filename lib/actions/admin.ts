'use server';

import { pickAllowedRestaurantUpdates, pickAllowedConfigUpdates, toConfigColumns } from '@/lib/utils/allowedUpdates';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Restaurant, UpdateRestaurantInput } from '@/lib/types/restaurant';
import type { AuditLog, AuditLogFilter, PlatformStats } from '@/lib/types/audit';
import type { PlatformConfig, UpdatePlatformConfigInput } from '@/lib/types/config';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient, getAdminClient, requireAdmin } from '@/lib/supabase/server';
import { TO_REVIEW_STATUSES } from '@/lib/constants/approval';
import { hasRecentTotp, RECENT_MFA_REQUIRED_MESSAGE } from '@/lib/utils/recentMfa';
import { normalizeSubscriptionPlan, type SubscriptionPlanKey } from '@/lib/utils/subscriptionPlan';
import { ADMIN_LOG_FAILED_MESSAGE, logAdminAction, logAdminReadOrThrow } from '@/lib/audit/adminLog';
import { dayAfter, PLATFORM_LOG_COLUMNS, toAuditLog, type PlatformLogRow } from '@/lib/utils/auditLog';

export async function getStatsAction(): Promise<PlatformStats> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  
  // Example dummy logic since we don't have the exact DB views yet
  // In a real scenario, this might call a Supabase RPC or count tables
  const [
    { count: totalRestaurants, error: err1 },
    { count: pendingApprovals, error: err2 },
    { count: premiumRestaurants, error: err3 },
    { count: activeUsers, error: err4 }
  ] = await Promise.all([
    // Active = approved (pending, refused and suspended ones are not)
    adminDb.from('restaurants').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),
    adminDb.from('restaurants').select('*', { count: 'exact', head: true }).in('approval_status', TO_REVIEW_STATUSES),
    adminDb.from('restaurants').select('*', { count: 'exact', head: true })
      .eq('approval_status', 'approved').eq('subscription_plan', 'premium'),
    adminDb.from('users').select('*', { count: 'exact', head: true }),
  ]);

  if (err1 || err2 || err3 || err4) {
    console.error('Error fetching stats:', { err1, err2, err3, err4 });
  }

  return {
    totalRestaurants: totalRestaurants || 0,
    pendingApprovals: pendingApprovals || 0,
    activeToday: activeUsers || 0,
    premiumCount: premiumRestaurants || 0,
    platformRevenueMTD: 0, // Requires an SQL sum() RPC or bookings aggregation
  };
}

export async function getRestaurantsAction(filters?: {
  status?: string | string[];
  subscription?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ restaurants: Restaurant[]; total: number }> {
  const admin = await requireAdmin();
  const adminDb = await getAdminClient();

  let query = adminDb.from('restaurants').select('*', { count: 'exact' });

  if (Array.isArray(filters?.status)) query = query.in('approval_status', filters.status);
  else if (filters?.status) query = query.eq('approval_status', filters.status);
  if (filters?.subscription) {
    const plan = normalizeSubscriptionPlan(filters.subscription);
    // Les lignes héritées peuvent encore porter 'free' : elles comptent comme Essentiel.
    query = plan === 'essentiel' ? query.in('subscription_plan', ['essentiel', 'free']) : query.eq('subscription_plan', plan);
  }
  if (filters?.search) query = query.ilike('name', `%${filters.search}%`);

  if (filters?.limit) {
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  // Consultation journalisée (RGPD-29) : filtres et nombre de lignes. Le texte cherché peut
  // être un nom : seule sa présence est notée.
  await logAdminReadOrThrow(admin, {
    action: 'list_restaurants', targetType: 'restaurant', targetId: null,
    details: {
      status: filters?.status ?? null, subscription: filters?.subscription ?? null,
      search: !!filters?.search, offset: filters?.offset ?? 0, count: data?.length ?? 0,
    },
  });

  // Transform data as necessary based on DB structure
  return { restaurants: (data as any) || [], total: count || 0 };
}

export async function getRestaurantDetailAction(restaurantId: string): Promise<Restaurant> {
  const admin = await requireAdmin();
  const adminDb = await getAdminClient();
  const { data, error } = await adminDb.from('restaurants').select('*').eq('id', restaurantId).single();
  if (error) throw new Error(error.message);
  await logAdminReadOrThrow(admin, { action: 'view_restaurant', targetType: 'restaurant', targetId: restaurantId });
  return data as any;
}

// Signed URL (5 min) to the Kbis, stored in the private onboarding-docs
// bucket. Returns the error instead of throwing (production masks messages).
export async function getKbisUrlAction(
  restaurantId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const adminDb = await getAdminClient();

  const { data, error } = await adminDb
    .from('restaurants')
    .select('kbis_path')
    .eq('id', restaurantId)
    .single();
  if (error) return { ok: false, error: error.message };

  const path: string | null = data?.kbis_path ?? null;
  if (!path) return { ok: false, error: 'Aucun Kbis déposé' };
  // Kbis = identité, date et lieu de naissance du dirigeant : pas de lien sans ligne au journal (RGPD-29, D2).
  if (!(await logAdminAction(admin, { action: 'view_kbis', targetType: 'kbis', targetId: restaurantId }))) {
    return { ok: false, error: ADMIN_LOG_FAILED_MESSAGE };
  }
  // Former uploads were public URLs
  if (path.startsWith('http')) return { ok: true, url: path };

  const { data: signed, error: signError } = await adminDb.storage
    .from('onboarding-docs')
    .createSignedUrl(path, 300);
  if (signError || !signed) return { ok: false, error: signError?.message ?? 'Lien indisponible' };
  return { ok: true, url: signed.signedUrl };
}

export async function updateRestaurantAction(restaurantId: string, updates: UpdateRestaurantInput): Promise<Restaurant> {
  const admin = await requireAdmin();
  // Liste blanche d'exécution : la commission passe uniquement par l'Edge Function commission-settings (TOTP).
  const { allowed, ignored } = pickAllowedRestaurantUpdates(updates);
  if (ignored.length > 0) {
    console.warn('[updateRestaurantAction] champs ignorés :', ignored.join(', '));
  }
  if (Object.keys(allowed).length === 0) {
    throw new Error('Aucun champ modifiable fourni.');
  }
  const adminDb = await getAdminClient();
  const { data, error } = await adminDb.from('restaurants').update(allowed).eq('id', restaurantId).select().single();
  if (error) throw new Error(error.message);
  // Noms des champs seulement : nom, e-mail, téléphone et adresse sont des données personnelles.
  await logAdminAction(admin, {
    action: 'update_restaurant', targetType: 'restaurant', targetId: restaurantId,
    details: { fields: Object.keys(allowed) },
  });
  return data as any;
}

// Approval and refusal go through the admin-onboarding Edge Function (status
// update + owner email), with the admin's own session: the function checks
// the admin claim. Suspension is a plain status update.
// Errors are returned, not thrown: production hides thrown messages.
export async function approveRestaurantAction(
  restaurantId: string,
  status: 'approved' | 'rejected' | 'suspended',
  reason?: string,
  correctionMode?: 'correction_required' | 'permanent'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();

  if (status === 'suspended') {
    const adminDb = await getAdminClient();
    const { error } = await adminDb.from('restaurants')
      .update({ approval_status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', restaurantId);
    if (error) return { ok: false, error: error.message };
    await logAdminAction(admin, { action: 'suspend_restaurant', targetType: 'restaurant', targetId: restaurantId });
    return { ok: true };
  }
  // Approbation et refus : journalisés par l'Edge Function admin-onboarding.

  const supabase = await createClient();
  const { error } = await supabase.functions.invoke('admin-onboarding', {
    body: status === 'approved'
      ? { action: 'approveOnboardingRestaurant', restaurantId }
      : { action: 'rejectOnboardingRestaurant', restaurantId, reason, correctionMode },
  });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      message = body?.error?.message ?? message;
    }
    return { ok: false, error: message };
  }
  return { ok: true };
}

const SUBSCRIPTION_PLAN_KEYS: readonly SubscriptionPlanKey[] = ['essentiel', 'croissance', 'liberte', 'premium'];

/**
 * Change le plan d'un restaurant. Le taux de commission en ligne suit le plan
 * (trigger SQL) : comme toute modification de taux, cela exige un code TOTP
 * vérifié il y a moins de 5 min (session AAL2, claim amr), contrôlé ici côté serveur.
 * Journalisé dans platform_logs (ancien/nouveau plan) ; auditLogged=false si
 * l'écriture du journal échoue (le plan est alors déjà modifié).
 */
export async function updateSubscriptionPlanAction(
  restaurantId: string,
  plan: SubscriptionPlanKey
): Promise<
  | { success: true; auditLogged: boolean }
  | { success: false; code: 'mfa-required'; error: string }
> {
  const user = await requireAdmin();
  if (!SUBSCRIPTION_PLAN_KEYS.includes(plan)) throw new Error('Plan invalide');

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  // Résultat plutôt qu'exception : en production le message d'une exception serveur est masqué.
  if (!hasRecentTotp(session?.access_token)) {
    return { success: false, code: 'mfa-required', error: RECENT_MFA_REQUIRED_MESSAGE };
  }

  const adminDb = await getAdminClient();
  const { data: current, error: readError } = await adminDb
    .from('restaurants').select('subscription_plan').eq('id', restaurantId).single();
  if (readError) throw new Error(readError.message);

  const { error } = await adminDb.from('restaurants').update({ subscription_plan: plan }).eq('id', restaurantId);
  if (error) throw new Error(error.message);

  const auditLogged = await logAdminAction(user, {
    action: 'subscription_plan_changed', targetType: 'restaurant', targetId: restaurantId,
    details: { oldPlan: current?.subscription_plan ?? null, newPlan: plan },
  });
  return { success: true, auditLogged };
}

export async function getAuditLogsAction(filters: AuditLogFilter): Promise<{ logs: AuditLog[]; total: number }> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  // Journal d'administration (RGPD-29) : platform_logs, seule table écrite (audit_logs supprimée au lot 9).
  let query = adminDb.from('platform_logs').select(PLATFORM_LOG_COLUMNS, { count: 'exact' });
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.resourceType) query = query.eq('target_type', filters.resourceType);
  if (filters.adminId) query = query.eq('performed_by', filters.adminId);
  if (filters.startDate) query = query.gte('created_at', new Date(filters.startDate).toISOString());
  if (filters.endDate) query = query.lt('created_at', dayAfter(new Date(filters.endDate)).toISOString());
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { logs: ((data ?? []) as PlatformLogRow[]).map(toAuditLog), total: count ?? 0 };
}

export async function getConfigAction(): Promise<PlatformConfig> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const { data, error } = await adminDb.from('app_config').select('*').eq('id', 'global').single();
  
  if (error && error.code !== 'PGRST116') throw new Error(error.message); // Ignore missing row (we'll return defaults)
  
  return {
    currency: data?.currency ?? 'EUR',
    maintenanceMode: data?.maintenance_mode ?? false,
    updatedAt: data?.updated_at ? new Date(data.updated_at) : undefined,
    updatedBy: data?.updated_by,
  };
}

export async function updateConfigAction(updates: UpdatePlatformConfigInput): Promise<PlatformConfig> {
  const user = await requireAdmin();
  const { allowed, ignored } = pickAllowedConfigUpdates(updates);
  if (ignored.length > 0) {
    console.warn('[updateConfigAction] champs ignorés :', ignored.join(', '));
  }
  if (Object.keys(allowed).length === 0) {
    throw new Error('Aucun champ modifiable fourni.');
  }
  const adminDb = await getAdminClient();
  
  const payload = {
    ...toConfigColumns(allowed),
    updated_by: user.email || user.id,
    updated_at: new Date().toISOString(),
  };
  
  const { data, error } = await adminDb.from('app_config').upsert({ id: 'global', ...payload }).select().single();
  if (error) throw new Error(error.message);
  // Liste blanche pickAllowedConfigUpdates (devise, mode maintenance) : valeurs non personnelles.
  await logAdminAction(user, {
    action: 'update_platform_config', targetType: 'config', targetId: 'global',
    details: { ...allowed },
  });
  
  return {
    currency: data?.currency ?? 'EUR',
    maintenanceMode: data?.maintenance_mode ?? false,
    updatedAt: data?.updated_at ? new Date(data.updated_at) : undefined,
    updatedBy: data?.updated_by,
  };
}
