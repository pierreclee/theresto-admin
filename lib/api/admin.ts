import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
import type { Restaurant, UpdateRestaurantInput } from '@/lib/types/restaurant';
import type { AuditLog, AuditLogFilter, PlatformStats } from '@/lib/types/audit';
import type { PlatformConfig, UpdatePlatformConfigInput } from '@/lib/types/config';
import { parseFirebaseError } from '@/lib/utils/errors';

export const adminApi = {
  getStats: async (): Promise<PlatformStats> => {
    try {
      const fn = httpsCallable(functions, 'getPlatformStats');
      const result = await fn({});
      return result.data as PlatformStats;
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  getRestaurants: async (filters?: {
    status?: string;
    subscription?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ restaurants: Restaurant[]; total: number }> => {
    try {
      const fn = httpsCallable(functions, 'getRestaurants');
      const result = await fn(filters || {});
      return result.data as { restaurants: Restaurant[]; total: number };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  getRestaurantDetail: async (restaurantId: string): Promise<Restaurant> => {
    try {
      const fn = httpsCallable(functions, 'getRestaurantDetail');
      const result = await fn({ restaurantId });
      return result.data as Restaurant;
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  updateRestaurant: async (restaurantId: string, updates: UpdateRestaurantInput): Promise<Restaurant> => {
    try {
      const fn = httpsCallable(functions, 'updateRestaurant');
      const result = await fn({ restaurantId, ...updates });
      return result.data as Restaurant;
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  setAdminFee: async (restaurantId: string, feePercent: number): Promise<{ success: boolean }> => {
    try {
      const fn = httpsCallable(functions, 'updateRestaurantCommission');
      await fn({ restaurantId, commissionRate: feePercent });
      return { success: true };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  approveRestaurant: async (
    restaurantId: string,
    status: 'approved' | 'rejected' | 'suspended',
    reason?: string,
    correctionMode?: 'correction_required' | 'permanent'
  ): Promise<{ success: boolean }> => {
    try {
      const fn = httpsCallable(functions, 'approveRestaurant');
      await fn({ restaurantId, status, reason: reason ?? null, correctionMode: correctionMode ?? null });
      return { success: true };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  updateSubscriptionPlan: async (
    restaurantId: string,
    plan: 'free' | 'premium'
  ): Promise<{ success: boolean }> => {
    try {
      const fn = httpsCallable(functions, 'updateSubscriptionPlan');
      await fn({ restaurantId, plan });
      return { success: true };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  getAuditLogs: async (filters: AuditLogFilter): Promise<{ logs: AuditLog[]; total: number }> => {
    try {
      const fn = httpsCallable(functions, 'getAuditLogs');
      const result = await fn(filters);
      return result.data as { logs: AuditLog[]; total: number };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  getConfig: async (): Promise<PlatformConfig> => {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'global'));
      const data = snap.data() ?? {};
      return {
        commissionRate: (data.commissionRate as number) ?? 5,
        currency: (data.currency as string) ?? 'EUR',
        maintenanceMode: (data.maintenanceMode as boolean) ?? false,
        updatedAt: data.updatedAt?.toDate?.() ?? undefined,
        updatedBy: (data.updatedBy as string) ?? undefined,
      };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  updateConfig: async (updates: UpdatePlatformConfigInput): Promise<PlatformConfig> => {
    try {
      const ref = doc(db, 'appConfig', 'global');
      await setDoc(
        ref,
        {
          ...updates,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? 'unknown',
        },
        { merge: true }
      );
      const snap = await getDoc(ref);
      const data = snap.data() ?? {};
      return {
        commissionRate: (data.commissionRate as number) ?? 5,
        currency: (data.currency as string) ?? 'EUR',
        maintenanceMode: (data.maintenanceMode as boolean) ?? false,
        updatedAt: data.updatedAt?.toDate?.() ?? undefined,
        updatedBy: (data.updatedBy as string) ?? undefined,
      };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },
};
