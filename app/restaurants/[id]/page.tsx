'use client';

import { use, useState } from 'react';
import { useRestaurantDetail } from '@/lib/hooks/useRestaurants';
import { RestaurantDetail } from '@/components/restaurants/RestaurantDetail';
import { FeeConfigModal } from '@/components/restaurants/FeeConfigModal';
import { Loading } from '@/components/shared/Loading';

export default function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: restaurant, isPending } = useRestaurantDetail(id);
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);

  if (isPending) return <Loading />;
  if (!restaurant) return <div className="p-6 text-gray-600">Restaurant non trouvé</div>;

  return (
    <>
      <RestaurantDetail
        restaurant={restaurant}
        onEditFee={() => setIsFeeModalOpen(true)}
      />
      <FeeConfigModal
        isOpen={isFeeModalOpen}
        onClose={() => setIsFeeModalOpen(false)}
        restaurantId={restaurant.id}
        currentFee={restaurant.commissionRate}
      />
    </>
  );
}
