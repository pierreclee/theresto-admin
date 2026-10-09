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
  phone_number?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  address?: string | null;
  description?: string | null;
  establishment_type?: string | null;
  cuisine_types?: string[];
  main_photo_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact?: RestaurantContact;
  diet_tags?: string[];
  atmosphere_tags?: string[];
  service_tags?: string[];
  rating?: number | null;
  review_count?: number;
  owner_id?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  approval_status: 'pending' | 'pending_admin_review' | 'approved' | 'rejected' | 'suspended';
  subscription_plan: 'free' | 'croissance' | 'liberte' | 'premium';
  is_mollie_connected: boolean;
  commission_rate: number;
  total_revenue?: number | null;
  monthly_revenue?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  sections_to_fix?: string[] | null;
  correction_mode?: 'correction_required' | 'permanent' | null;
  approved_at?: string | null;

  // Legacy camelCase aliases for compatibility (deprecated)
  approvalStatus?: string;
  subscriptionPlan?: string;
  isMollieConnected?: boolean;
  commissionRate?: number;
  ownerId?: string;
  phone?: string;
  mainPhotoUrl?: string | null;
  cuisineTypes?: string[];
  establishmentType?: string | null;
  dietTags?: string[];
  atmosphereTags?: string[];
  serviceTags?: string[];
  reviewCount?: number;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  totalRevenue?: number | null;
  monthlyRevenue?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// Columns of public.restaurants (sent as is to the update)
export interface UpdateRestaurantInput {
  name?: string;
  email?: string | null;
  phone_number?: string | null;
  address?: string | null;
  description?: string | null;
  establishment_type?: string | null;
  cuisine_types?: string[];
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
}

export interface RestaurantWithStats extends Restaurant {
  bookingCount: number;
  avgRating: number;
}
