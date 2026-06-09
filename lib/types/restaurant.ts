export interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  subscriptionPlan: 'free' | 'premium';
  isMollieConnected: boolean;
  commissionRate: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateRestaurantInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface RestaurantWithStats extends Restaurant {
  bookingCount: number;
  avgRating: number;
}
