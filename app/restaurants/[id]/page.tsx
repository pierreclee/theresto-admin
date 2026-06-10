'use client';

import { use } from 'react';
import { useRestaurantDetail } from '@/lib/hooks/useRestaurants';
import { RestaurantDetail } from '@/components/restaurants/RestaurantDetail';
import { Loading } from '@/components/shared/Loading';

export default function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: restaurant, isPending } = useRestaurantDetail(id);

  if (isPending) return <Loading />;
  if (!restaurant) return <div className="p-6 text-gray-600">Restaurant non trouvé</div>;

  return <RestaurantDetail restaurant={restaurant} />;
}
