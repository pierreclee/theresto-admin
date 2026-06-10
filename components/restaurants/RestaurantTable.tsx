'use client';

import { Restaurant } from '@/lib/types/restaurant';
import { Table } from '@/components/shared/Table';

const approvalLabel: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approuvé', className: 'bg-green-50 text-green-700 border-green-100' },
  pending:  { label: 'En attente', className: 'bg-orange-50 text-orange-700 border-orange-100' },
  rejected: { label: 'Rejeté', className: 'bg-red-50 text-red-700 border-red-100' },
  suspended:{ label: 'Suspendu', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const planLabel: Record<string, { label: string; className: string }> = {
  premium: { label: 'Premium ★', className: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
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
  return (
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
          render: (v) => <StatusBadge value={String(v)} map={planLabel} />,
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
  );
}
