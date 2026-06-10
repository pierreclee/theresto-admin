import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { parseFirebaseError } from '@/lib/utils/errors';
import type { AppUser, UserCrmProfile, ModerationAction } from '@/lib/types/user';

const PAGE_SIZE = 50;

function docToUser(id: string, data: Record<string, unknown>): AppUser {
  const parseDate = (v: unknown): Date | undefined => {
    if (!v) return undefined;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    if (typeof v === 'string') { try { return new Date(v); } catch { return undefined; } }
    return undefined;
  };

  return {
    id,
    email: (data.email as string) ?? '',
    name: (data.name as string) ?? '',
    phoneNumber: (data.phoneNumber as string) ?? undefined,
    photoUrl: (data.photoUrl as string) ?? undefined,
    roles: Array.isArray(data.roles) ? (data.roles as string[]) : ['customer'],
    restaurantId: (data.restaurantId as string) ?? undefined,
    loyaltyPoints: (data.loyaltyPoints as number) ?? 0,
    lifetimePoints: (data.lifetimePoints as number) ?? 0,
    moderationStatus: (['active', 'suspended', 'banned'].includes(data.moderationStatus as string)
      ? data.moderationStatus
      : 'active') as AppUser['moderationStatus'],
    moderationReason: (data.moderationReason as string) ?? undefined,
    moderatedAt: parseDate(data.moderatedAt),
    createdAt: parseDate(data.createdAt),
    updatedAt: parseDate(data.updatedAt),
  };
}

export const usersApi = {
  listUsers: async (opts: {
    roleFilter?: string;
    statusFilter?: string;
    cursor?: DocumentSnapshot;
  }): Promise<{ users: AppUser[]; cursor: DocumentSnapshot | null }> => {
    try {
      const col = collection(db, 'users');
      const hasStatus = !!opts.statusFilter;
      const hasCursor = !!opts.cursor;

      const q =
        hasStatus && hasCursor
          ? query(col, where('moderationStatus', '==', opts.statusFilter), orderBy('createdAt', 'desc'), startAfter(opts.cursor), limit(PAGE_SIZE))
          : hasStatus
          ? query(col, where('moderationStatus', '==', opts.statusFilter), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : hasCursor
          ? query(col, orderBy('createdAt', 'desc'), startAfter(opts.cursor), limit(PAGE_SIZE))
          : query(col, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

      const snap = await getDocs(q);

      const users = snap.docs.map((d) => docToUser(d.id, d.data() as Record<string, unknown>));
      const lastDoc = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;

      return { users, cursor: lastDoc };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  getCrmProfile: async (userId: string): Promise<UserCrmProfile> => {
    try {
      const fn = httpsCallable(functions, 'getUserCrmProfile');
      const result = await fn({ userId });
      const data = result.data as {
        user: Record<string, unknown>;
        stats: UserCrmProfile['stats'];
        recentBookings: UserCrmProfile['recentBookings'];
        favoriteRestaurants: UserCrmProfile['favoriteRestaurants'];
      };
      return {
        user: docToUser(data.user.id as string, data.user),
        stats: data.stats,
        recentBookings: data.recentBookings,
        favoriteRestaurants: data.favoriteRestaurants,
      };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },

  moderateUser: async (
    userId: string,
    action: ModerationAction,
    reason?: string
  ): Promise<{ newStatus: string }> => {
    try {
      const fn = httpsCallable(functions, 'moderateUser');
      const result = await fn({ userId, action, reason });
      return result.data as { newStatus: string };
    } catch (error) {
      throw parseFirebaseError(error);
    }
  },
};
