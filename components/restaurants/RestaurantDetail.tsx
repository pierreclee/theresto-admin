'use client';

import { Restaurant } from '@/lib/types/restaurant';
import { Card, StatCard } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';

interface RestaurantDetailProps {
  restaurant: Restaurant;
  onEditFee: () => void;
}

export function RestaurantDetail({ restaurant, onEditFee }: RestaurantDetailProps) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
            <p className="text-gray-600 mt-1">{restaurant.email}</p>
          </div>
          <Badge
            label={restaurant.approvalStatus.toUpperCase()}
            variant={
              restaurant.approvalStatus === 'approved'
                ? 'success'
                : restaurant.approvalStatus === 'pending'
                  ? 'warning'
                  : 'error'
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Téléphone</p>
            <p className="font-semibold">{restaurant.phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Adresse</p>
            <p className="font-semibold">{restaurant.address || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Plan</p>
            <Badge
              label={restaurant.subscriptionPlan.toUpperCase()}
              variant={restaurant.subscriptionPlan === 'premium' ? 'primary' : 'gray'}
            />
          </div>
          <div>
            <p className="text-sm text-gray-600">Mollie connecté</p>
            <p className="font-semibold">{restaurant.isMollieConnected ? 'Oui' : 'Non'}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard icon="💰" label="Revenu Total" value={`€${(restaurant.totalRevenue || 0).toFixed(2)}`} color="green" />
        <StatCard icon="📊" label="Revenu MTD" value={`€${(restaurant.monthlyRevenue || 0).toFixed(2)}`} color="blue" />
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Commission TheResto</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">Taux de commission</p>
            <p className="text-2xl font-bold text-blue-600">{restaurant.commissionRate}%</p>
          </div>
          <button
            onClick={onEditFee}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Modifier
          </button>
        </div>
      </Card>
    </div>
  );
}
