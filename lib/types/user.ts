export type ModerationStatus = 'active' | 'suspended' | 'banned';
export type ModerationAction = 'suspend' | 'ban' | 'activate';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  photoUrl?: string;
  roles: string[];
  restaurantId?: string;
  loyaltyPoints: number;
  lifetimePoints: number;
  moderationStatus: ModerationStatus;
  moderationReason?: string;
  moderatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCrmStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  completionRate: number;
  averagePartySize: number;
  totalSpent: number;
}

export interface UserCrmBooking {
  id: string;
  restaurantId: string;
  restaurantName: string;
  bookingDate: string | null;
  status: string;
  numberOfGuests: number;
  reservationType: string;
  totalAmount: number | null;
  paidAmount: number | null;
  paymentStatus: string | null;
}

export interface UserCrmProfile {
  user: AppUser;
  stats: UserCrmStats;
  recentBookings: UserCrmBooking[];
  favoriteRestaurants: { restaurantId: string; restaurantName: string; bookingCount: number }[];
}
