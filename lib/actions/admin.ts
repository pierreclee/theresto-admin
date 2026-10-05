'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Restaurant, UpdateRestaurantInput } from '@/lib/types/restaurant';
import type { AuditLog, AuditLogFilter, PlatformStats } from '@/lib/types/audit';
import type { PlatformConfig, UpdatePlatformConfigInput } from '@/lib/types/config';

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';

export async function getStatsAction(): Promise<PlatformStats> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  
  // Example dummy logic since we don't have the exact DB views yet
  // In a real scenario, this might call a Supabase RPC or count tables
  const [{ count: activeRestaurants }, { count: pendingApprovals }, { count: totalUsers }, { count: activeUsers }] = await Promise.all([
    adminDb.from('restaurants').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    adminDb.from('restaurants').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    adminDb.from('users').select('*', { count: 'exact', head: true }),
    adminDb.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  return {
    totalRestaurants: activeRestaurants || 0,
    pendingApprovals: pendingApprovals || 0,
    activeToday: activeUsers || 0,
    premiumCount: 0, // Mocked for now
    platformRevenueMTD: 0, // Mocked for now
  };
}

export async function getRestaurantsAction(filters?: {
  status?: string;
  subscription?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ restaurants: Restaurant[]; total: number }> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  
  let query = adminDb.from('restaurants').select('*', { count: 'exact' });
  
  if (filters?.status) query = query.eq('status', filters.status);
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
  
  const payload: any = { status };
  if (reason) payload.moderation_reason = reason;
  if (correctionMode) payload.correction_mode = correctionMode;
  
  const { error } = await adminDb.from('restaurants').update(payload).eq('id', restaurantId);
  if (error) throw new Error(error.message);
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
