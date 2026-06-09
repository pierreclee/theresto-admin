'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { Table } from '@/components/shared/Table';
import { Badge } from '@/components/shared/Badge';
import { AuditLog } from '@/lib/types/audit';

export function AuditLogsViewer() {
  const [filters, setFilters] = useState({
    limit: 50,
    offset: 0,
  });

  const { data, isPending } = useAuditLogs(filters);

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="date"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              startDate: e.target.value ? new Date(e.target.value) : undefined,
            }))
          }
        />
        <input
          type="date"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
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
            render: (value) => new Date(value as unknown as string).toLocaleString('fr-FR'),
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
