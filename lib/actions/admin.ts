'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Restaurant, UpdateRestaurantInput } from '@/lib/types/restaurant';
import type { AuditLog, AuditLogFilter, PlatformStats } from '@/lib/types/audit';
import type { PlatformConfig, UpdatePlatformConfigInput } from '@/lib/types/config';

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';
import { TO_REVIEW_STATUSES } from '@/lib/constants/approval';

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
    adminDb.from('restaurants').select('*', { count: 'exact', head: true }),
    adminDb.from('restaurants').select('*', { count: 'exact', head: true }).in('approval_status', TO_REVIEW_STATUSES),
    adminDb.from('restaurants').select('*', { count: 'exact', head: true }).eq('subscription_plan', 'premium'),
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
  await requireAdmin();
  const adminDb = await getAdminClient();

  let query = adminDb.from('restaurants').select('*', { count: 'exact' });

  if (Array.isArray(filters?.status)) query = query.in('approval_status', filters.status);
  else if (filters?.status) query = query.eq('approval_status', filters.status);
  if (filters?.subscription) query = query.eq('subscription_plan', filters.subscription);
  if (filters?.search) query = query.ilike('name', `%${filters.search}%`);

  if (filters?.limit) {
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  // Transform data as necessary based on DB structure
  return { restaurants: (data as any) || [], total: count || 0 };
}

export async function getRestaurantDetailAction(restaurantId: string): Promise<Restaurant> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const { data, error } = await adminDb.from('restaurants').select('*').eq('id', restaurantId).single();
  if (error) throw new Error(error.message);
  return data as any;
}

// Signed URL (5 min) to the Kbis, stored in the private onboarding-docs
// bucket. Returns the error instead of throwing (production masks messages).
export async function getKbisUrlAction(
  restaurantId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const adminDb = await getAdminClient();

  const { data, error } = await adminDb
    .from('restaurants')
    .select('kbis_path')
    .eq('id', restaurantId)
    .single();
  if (error) return { ok: false, error: error.message };

  const path: string | null = data?.kbis_path ?? null;
  if (!path) return { ok: false, error: 'Aucun Kbis déposé' };
  // Former uploads were public URLs
  if (path.startsWith('http')) return { ok: true, url: path };

  const { data: signed, error: signError } = await adminDb.storage
    .from('onboarding-docs')
    .createSignedUrl(path, 300);
  if (signError || !signed) return { ok: false, error: signError?.message ?? 'Lien indisponible' };
  return { ok: true, url: signed.signedUrl };
}

export async function updateRestaurantAction(restaurantId: string, updates: UpdateRestaurantInput): Promise<Restaurant> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const { data, error } = await adminDb.from('restaurants').update(updates).eq('id', restaurantId).select().single();
  if (error) throw new Error(error.message);
  return data as any;
}

export async function setAdminFeeAction(restaurantId: string, feePercent: number): Promise<{ success: boolean }> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const { error } = await adminDb.from('restaurants').update({ commission_rate: feePercent }).eq('id', restaurantId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function approveRestaurantAction(
  restaurantId: string,
  status: 'approved' | 'rejected' | 'suspended',
  reason?: string,
  correctionMode?: 'correction_required' | 'permanent'
): Promise<{ success: boolean }> {
  await requireAdmin();
  const adminDb = await getAdminClient();

  const payload: any = { approval_status: status };

  if (status === 'rejected') {
    if (reason) payload.rejection_reason = reason;
    if (correctionMode) payload.correction_mode = correctionMode;
    payload.rejected_at = new Date().toISOString();
  } else if (status === 'approved') {
    payload.approved_at = new Date().toISOString();
  }

  const { error } = await adminDb.from('restaurants').update(payload).eq('id', restaurantId);
  if (error) throw new Error(error.message);

  // Send notification email via Edge Function
  const edgeFunctionUrl = process.env.SUPABASE_URL + '/functions/v1/admin-onboarding';
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (status === 'approved') {
    await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'approveOnboardingRestaurant',
        restaurantId,
      }),
    }).catch(err => console.error('Email notification failed:', err));
  } else if (status === 'rejected') {
    const { data: restaurant } = await adminDb.from('restaurants')
      .select('name, owner_id').eq('id', restaurantId).single();

    if (restaurant?.owner_id) {
      const { data: owner } = await adminDb.from('users')
        .select('email, display_name').eq('id', restaurant.owner_id).single();

      if (owner?.email) {
        // Send rejection email
        await fetch(process.env.SUPABASE_URL + '/functions/v1/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            to: owner.email,
            subject: 'Votre restaurant — Décision d\'approbation',
            template: 'RESTAURANT_REJECTED',
            variables: {
              RESTAURANT_NAME: restaurant.name ?? '',
              REJECTION_REASON: reason ?? 'N/A',
              CORRECTION_MODE: correctionMode ?? '',
            },
          }),
        }).catch(err => console.error('Rejection email failed:', err));
      }
    }
  }

  return { success: true };
}

export async function updateSubscriptionPlanAction(
  restaurantId: string,
  plan: 'free' | 'croissance' | 'liberte' | 'premium'
): Promise<{ success: boolean }> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const { error } = await adminDb.from('restaurants').update({ subscription_plan: plan }).eq('id', restaurantId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getAuditLogsAction(filters: AuditLogFilter): Promise<{ logs: AuditLog[]; total: number }> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  
  let query = adminDb.from('audit_logs').select('*', { count: 'exact' });
  
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.resourceType) query = query.eq('resource_type', filters.resourceType);
  if (filters.adminId) query = query.eq('admin_id', filters.adminId);
  if (filters.limit) query = query.limit(filters.limit);
  
  query = query.order('created_at', { ascending: false });
  
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  
  return { logs: (data as any) || [], total: count || 0 };
}

export async function getConfigAction(): Promise<PlatformConfig> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  const { data, error } = await adminDb.from('app_config').select('*').eq('id', 'global').single();
  
  if (error && error.code !== 'PGRST116') throw new Error(error.message); // Ignore missing row (we'll return defaults)
  
  return {
    commissionRate: data?.commission_rate ?? 5,
    currency: data?.currency ?? 'EUR',
    maintenanceMode: data?.maintenance_mode ?? false,
    updatedAt: data?.updated_at ? new Date(data.updated_at) : undefined,
    updatedBy: data?.updated_by,
  };
}

export async function updateConfigAction(updates: UpdatePlatformConfigInput): Promise<PlatformConfig> {
  const user = await requireAdmin();
  const adminDb = await getAdminClient();
  
  const payload = {
    ...updates,
    updated_by: user.email || user.id,
    updated_at: new Date().toISOString(),
  };
  
  const { data, error } = await adminDb.from('app_config').upsert({ id: 'global', ...payload }).select().single();
  if (error) throw new Error(error.message);
  
  return {
    commissionRate: data?.commission_rate ?? 5,
    currency: data?.currency ?? 'EUR',
    maintenanceMode: data?.maintenance_mode ?? false,
    updatedAt: data?.updated_at ? new Date(data.updated_at) : undefined,
    updatedBy: data?.updated_by,
  };
}
