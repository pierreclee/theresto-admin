'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useRestaurantDetail } from '@/lib/hooks/useRestaurants';
import { RestaurantDetail } from '@/components/restaurants/RestaurantDetail';
import { Loading } from '@/components/shared/Loading';

export default function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: restaurant, isPending } = useRestaurantDetail(id);

  if (isPending) return <Loading />;
  if (!restaurant) return <div className="p-6 text-gray-600">Restaurant non trouvé</div>;

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.push('/restaurants')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour aux restaurants
      </button>
      <RestaurantDetail restaurant={restaurant} />
    </div>
  );
}
