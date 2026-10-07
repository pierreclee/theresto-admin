'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRestaurants } from '@/lib/hooks/useRestaurants';
import { RestaurantTable } from '@/components/restaurants/RestaurantTable';
import { RestaurantDetail } from '@/components/restaurants/RestaurantDetail';
import { Search, ChevronLeft, Clock, AlertCircle } from 'lucide-react';
import type { Restaurant } from '@/lib/types/restaurant';

function ApprovalsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Fetch restaurants with pending approval status
  const { data, isPending, error } = useRestaurants({
    status: 'pending',
    search: search || undefined,
  });

  const pendingCount = data?.total ?? 0;

  const handleViewDetails = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setShowDetail(true);
  };

  const handleBack = () => {
    setShowDetail(false);
    setSelectedRestaurant(null);
  };

  if (showDetail && selectedRestaurant) {
    return (
      <div className="space-y-5">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft size={15} />
          Retour aux approbations
        </button>
        <RestaurantDetail restaurant={selectedRestaurant} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={20} className="text-orange-500" />
          <h2 className="text-xl font-bold text-gray-900">Approbations en attente</h2>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {pendingCount === 0
            ? 'Aucun restaurant en attente d\'approbation'
            : `${pendingCount} restaurant${pendingCount !== 1 ? 's' : ''} nécessite${pendingCount !== 1 ? 'nt' : ''} votre validation`}
        </p>
      </div>

      {/* Info banner */}
      {pendingCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">Restaurants en attente d'approbation</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Vérifiez les informations soumises et approvez ou refusez chaque restaurant. Les propriétaires recevront une notification par email.
            </p>
          </div>
        </div>
      )}

      {/* Search and filter */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex gap-3 px-5 py-4 border-b border-gray-50">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un restaurant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
            Erreur de chargement des restaurants
          </div>
        )}

        {pendingCount === 0 && !isPending && (
          <div className="px-5 py-8 text-center">
            <p className="text-gray-400 text-sm mb-3">Aucun restaurant en attente d'approbation</p>
            <button
              onClick={() => router.push('/restaurants')}
              className="text-sm text-[#FF6B35] hover:underline font-medium"
            >
              Voir tous les restaurants
            </button>
          </div>
        )}

        {pendingCount > 0 && (
          <RestaurantTable
            restaurants={data?.restaurants ?? []}
            loading={isPending}
            onRowClick={handleViewDetails}
          />
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Chargement…</div>}>
      <ApprovalsContent />
    </Suspense>
  );
}
