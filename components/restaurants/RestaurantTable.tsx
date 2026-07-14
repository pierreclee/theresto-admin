'use client';

import { useState } from 'react';
import { Restaurant } from '@/lib/types/restaurant';
import { Table } from '@/components/shared/Table';
import { SubscriptionModal } from '@/components/restaurants/SubscriptionModal';

const approvalLabel: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approuvé', className: 'bg-green-50 text-green-700 border-green-100' },
  pending:  { label: 'En attente', className: 'bg-orange-50 text-orange-700 border-orange-100' },
  rejected: { label: 'Rejeté', className: 'bg-red-50 text-red-700 border-red-100' },
  suspended:{ label: 'Suspendu', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const planLabel: Record<string, { label: string; className: string }> = {
  premium: { label: 'Premium ★', className: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  liberte: { label: 'Liberté', className: 'bg-blue-50 text-blue-700 border-blue-100' },
  free:    { label: 'Free', className: 'bg-gray-50 text-gray-500 border-gray-100' },
};

function StatusBadge({ value, map }: { value: string; map: typeof approvalLabel }) {
  const cfg = map[value] ?? { label: value, className: 'bg-gray-50 text-gray-500 border-gray-100' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

interface RestaurantTableProps {
  restaurants: Restaurant[];
  loading: boolean;
  onRowClick: (restaurant: Restaurant) => void;
}

export function RestaurantTable({ restaurants, loading, onRowClick }: RestaurantTableProps) {
  const [subscriptionTarget, setSubscriptionTarget] = useState<Restaurant | null>(null);

  return (
    <>
      <Table<Restaurant>
        columns={[
          { key: 'name', label: 'Restaurant', width: 'w-1/4' },
          { key: 'email', label: 'Email', width: 'w-1/4' },
          {
            key: 'approvalStatus',
            label: 'Statut',
            render: (v) => <StatusBadge value={String(v)} map={approvalLabel} />,
          },
          {
            key: 'subscriptionPlan',
            label: 'Plan',
            render: (v, row) => (
              <button
                onClick={(e) => { e.stopPropagation(); setSubscriptionTarget(row); }}
                className="group/plan inline-flex items-center gap-1"
                title="Modifier l'abonnement"
              >
                <StatusBadge value={String(v)} map={planLabel} />
                <span className="text-xs text-gray-300 group-hover/plan:text-gray-500 transition-colors">✎</span>
              </button>
            ),
          },
          {
            key: 'monthlyRevenue',
            label: 'Revenu (MTD)',
            render: (v) =>
              ((v as number) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }),
          },
        ]}
        data={restaurants}
        keyField="id"
        loading={loading}
        onRowClick={onRowClick}
      />

      {subscriptionTarget && (
        <SubscriptionModal
          restaurantId={subscriptionTarget.id}
          restaurantName={subscriptionTarget.name}
          currentPlan={subscriptionTarget.subscriptionPlan}
          onClose={() => setSubscriptionTarget(null)}
        />
      )}
    </>
  );
}
