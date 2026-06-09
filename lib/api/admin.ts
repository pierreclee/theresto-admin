import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { Restaurant, UpdateRestaurantInput } from '@/lib/types/restaurant';
import type { AuditLog, AuditLogFilter, PlatformStats } from '@/lib/types/audit';
import { parseFirebaseError } from '@/lib/utils/errors';

export const adminApi = {
  getStats: async (): Promise<PlatformStats> => {
    try {
      const fn = httpsCallable(functions, 'getAdminStats');
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
      const fn = httpsCallable(functions, 'setAdminFee');
      await fn({ restaurantId, feePercent });
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
};
