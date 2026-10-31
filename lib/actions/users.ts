'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { AppUser, UserCrmProfile, ModerationAction } from '@/lib/types/user';

const PAGE_SIZE = 50;

import { getAdminClient, requireAdmin } from '@/lib/supabase/server';
import { logAdminReadOrThrow } from '@/lib/audit/adminLog';

export async function listUsersAction(opts: {
  roleFilter?: string;
  statusFilter?: string;
  cursor?: number;
}): Promise<{ users: AppUser[]; cursor: number | null }> {
  const admin = await requireAdmin();
  const adminDb = await getAdminClient();
  
  let query = adminDb.from('users').select('*');
  
  if (opts.statusFilter) query = query.eq('moderation_status', opts.statusFilter);
  // Example for roles depending on how it's stored in Supabase:
  // if (opts.roleFilter) query = query.contains('roles', [opts.roleFilter]);
  
  const offset = opts.cursor || 0;
  query = query.range(offset, offset + PAGE_SIZE - 1).order('created_at', { ascending: false });
  
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  
  // Consultation journalisée (RGPD-29) : filtres et nombre de lignes, jamais les personnes.
  await logAdminReadOrThrow(admin, {
    action: 'list_users', targetType: 'user', targetId: null,
    details: { statusFilter: opts.statusFilter ?? null, offset, count: data?.length ?? 0 },
  });

  const users: AppUser[] = (data || []).map(toAppUser);

  const nextCursor = data?.length === PAGE_SIZE ? offset + PAGE_SIZE : null;
  return { users, cursor: nextCursor };
}

// One user (restaurant owner link). Null when not found.
export async function getUserAction(userId: string): Promise<AppUser | null> {
  const admin = await requireAdmin();
  const adminDb = await getAdminClient();
  const { data } = await adminDb.from('users').select('*').eq('id', userId).maybeSingle();
  if (!data) return null;
  await logAdminReadOrThrow(admin, { action: 'view_user', targetType: 'user', targetId: userId });
  return toAppUser(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAppUser(d: any): AppUser {
  return {
    id: d.id,
    email: d.email,
    name: d.name,
    phoneNumber: d.phone_number,
    photoUrl: d.photo_url,
    roles: d.roles || ['customer'],
    restaurantId: d.restaurant_id,
    loyaltyPoints: d.loyalty_points || 0,
    lifetimePoints: d.lifetime_points || 0,
    moderationStatus: d.moderation_status || 'active',
    moderationReason: d.moderation_reason,
    moderatedAt: d.moderated_at ? new Date(d.moderated_at) : undefined,
    createdAt: d.created_at ? new Date(d.created_at) : undefined,
    updatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
  };
}

export async function getCrmProfileAction(userId: string): Promise<UserCrmProfile> {
  const admin = await requireAdmin();
  const adminDb = await getAdminClient();
  
  // Example dummy aggregation
  const [userRes, statsRes, bookingsRes, favoritesRes] = await Promise.all([
    adminDb.from('users').select('*').eq('id', userId).single(),
    adminDb.from('user_stats').select('*').eq('user_id', userId).maybeSingle(),
    adminDb.from('bookings').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    adminDb.from('favorite_restaurants').select('restaurant_id').eq('user_id', userId)
  ]);
  
  if (userRes.error) throw new Error(userRes.error.message);
  await logAdminReadOrThrow(admin, { action: 'view_user_profile', targetType: 'user', targetId: userId });
  
  const d = userRes.data;
  const user: AppUser = {
    id: d.id,
    email: d.email,
    name: d.name,
    phoneNumber: d.phone_number,
    photoUrl: d.photo_url,
    roles: d.roles || ['customer'],
    restaurantId: d.restaurant_id,
    loyaltyPoints: d.loyalty_points || 0,
    lifetimePoints: d.lifetime_points || 0,
    moderationStatus: d.moderation_status || 'active',
    moderationReason: d.moderation_reason,
    moderatedAt: d.moderated_at ? new Date(d.moderated_at) : undefined,
    createdAt: d.created_at ? new Date(d.created_at) : undefined,
    updatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
  };
  
  return {
    user,
    stats: statsRes.data || { totalOrders: 0, totalSpent: 0, noShowCount: 0, averageRating: 0 },
    recentBookings: bookingsRes.data || [],
    favoriteRestaurants: (favoritesRes.data || []).map((f: any) => f.restaurant_id),
  };
}

export async function moderateUserAction(
  userId: string,
  action: ModerationAction,
  reason?: string
): Promise<{ newStatus: string }> {
  await requireAdmin();
  const adminDb = await getAdminClient();
  
  let newStatus = 'active';
  if (action === 'suspend') newStatus = 'suspended';
  if (action === 'ban') newStatus = 'banned';
  if (action === 'activate') newStatus = 'active';
  
  const payload: any = {
    moderation_status: newStatus,
    moderated_at: new Date().toISOString(),
  };
  if (reason) payload.moderation_reason = reason;
  
  const { error } = await adminDb.from('users').update(payload).eq('id', userId);
  if (error) throw new Error(error.message);
  
  return { newStatus };
}
