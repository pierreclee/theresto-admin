'use client';

import { Restaurant } from '@/lib/types/restaurant';
import { Table } from '@/components/shared/Table';
import { Badge } from '@/components/shared/Badge';

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
          render: (status) => {
            const variant =
              status === 'approved'
                ? 'success'
                : status === 'pending'
                  ? 'warning'
                  : 'error';
            return <Badge label={String(status).toUpperCase()} variant={variant as any} />;
          },
        },
        {
          key: 'subscriptionPlan',
          label: 'Plan',
          render: (plan) => <Badge label={String(plan).toUpperCase()} variant={plan === 'premium' ? 'primary' : 'gray'} />,
        },
        {
          key: 'monthlyRevenue',
          label: 'Revenu (MTD)',
          render: (v) => `€${((v as number) || 0).toFixed(2)}`,
        },
      ]}
      data={restaurants}
      keyField="id"
      loading={loading}
      onRowClick={onRowClick}
    />
  );
}
