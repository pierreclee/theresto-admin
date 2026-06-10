'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRestaurants } from '@/lib/hooks/useRestaurants';
import { RestaurantTable } from '@/components/restaurants/RestaurantTable';
import { Search, SlidersHorizontal } from 'lucide-react';

function RestaurantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');

  const { data, isPending, error } = useRestaurants({
    search: search || undefined,
    status: status || undefined,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Restaurants</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {data ? `${data.total} restaurant${data.total !== 1 ? 's' : ''}` : 'Chargement…'}
        </p>
      </div>

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
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-gray-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] bg-white"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvés</option>
              <option value="rejected">Refusés</option>
              <option value="suspended">Suspendus</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
            Erreur de chargement des restaurants
          </div>
        )}

        <RestaurantTable
          restaurants={data?.restaurants ?? []}
          loading={isPending}
          onRowClick={(restaurant) => router.push(`/restaurants/${restaurant.id}`)}
        />
      </div>
    </div>
  );
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Chargement…</div>}>
      <RestaurantsContent />
    </Suspense>
  );
}
