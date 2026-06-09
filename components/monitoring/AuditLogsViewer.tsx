'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { Table } from '@/components/shared/Table';
import { Badge } from '@/components/shared/Badge';
import { AuditLog } from '@/lib/types/audit';

export function AuditLogsViewer() {
  const [filters, setFilters] = useState<{
    limit: number;
    offset: number;
    startDateInput?: string;
    endDateInput?: string;
    startDate?: Date;
    endDate?: Date;
  }>({
    limit: 50,
    offset: 0,
  });

  const { data, isPending } = useAuditLogs({
    limit: filters.limit,
    offset: filters.offset,
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="date"
          value={filters.startDateInput ?? ''}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              startDateInput: e.target.value,
              startDate: e.target.value ? new Date(e.target.value) : undefined,
            }))
          }
        />
        <input
          type="date"
          value={filters.endDateInput ?? ''}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              endDateInput: e.target.value,
              endDate: e.target.value ? new Date(e.target.value) : undefined,
            }))
          }
        />
      </div>

      <Table<AuditLog>
        columns={[
          {
            key: 'timestamp',
            label: 'Date',
            render: (value) => {
              const ts = value as Date | { toDate?: () => Date } | string | number;
              const date = typeof ts === 'object' && ts !== null && 'toDate' in ts && ts.toDate
                ? ts.toDate()
                : new Date(ts as string | number | Date);
              return isNaN(date.getTime()) ? '-' : date.toLocaleString('fr-FR');
            },
          },
          { key: 'adminEmail', label: 'Admin' },
          { key: 'action', label: 'Action' },
          { key: 'resourceType', label: 'Ressource' },
          {
            key: 'success',
            label: 'Statut',
            render: (success) => (
              <Badge
                label={success ? 'Succès' : 'Erreur'}
                variant={success ? 'success' : 'error'}
              />
            ),
          },
        ]}
        data={data?.logs ?? []}
        keyField="id"
        loading={isPending}
      />

      {data && data.total > filters.limit && (
        <div className="flex justify-center gap-4">
          <button
            disabled={filters.offset === 0}
            onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="px-4 py-2 text-gray-600">
            Page {Math.floor(filters.offset / filters.limit) + 1} sur{' '}
            {Math.ceil(data.total / filters.limit)}
          </span>
          <button
            disabled={filters.offset + filters.limit >= data.total}
            onClick={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
