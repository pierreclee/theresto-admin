'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurants } from '@/lib/hooks/useRestaurants';
import { RestaurantTable } from '@/components/restaurants/RestaurantTable';
import { Card } from '@/components/shared/Card';

export default function RestaurantsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<{ search?: string; status?: string }>({});
  const { data, isPending, error } = useRestaurants(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Restaurants</h1>
        <p className="text-gray-600 mt-2">Gérez tous les restaurants de la plateforme</p>
      </div>

      <Card>
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Rechercher..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="approved">Approuvés</option>
            <option value="rejected">Refusés</option>
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg mb-4">
            Erreur de chargement des restaurants
          </div>
        )}

        <RestaurantTable
          restaurants={data?.restaurants ?? []}
          loading={isPending}
          onRowClick={(restaurant) => router.push(`/restaurants/${restaurant.id}`)}
        />
      </Card>
    </div>
  );
}
