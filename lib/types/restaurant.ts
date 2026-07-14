export interface RestaurantContact {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  establishmentType?: string | null;
  cuisineTypes?: string[];
  mainPhotoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact?: RestaurantContact;
  dietTags?: string[];
  atmosphereTags?: string[];
  serviceTags?: string[];
  rating?: number | null;
  reviewCount?: number;
  ownerId?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  subscriptionPlan: 'free' | 'liberte' | 'premium';
  isMollieConnected: boolean;
  commissionRate: number;
  totalRevenue?: number | null;
  monthlyRevenue?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UpdateRestaurantInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  establishmentType?: string;
  cuisineTypes?: string[];
  contact?: RestaurantContact;
}

export interface RestaurantWithStats extends Restaurant {
  bookingCount: number;
  avgRating: number;
}
