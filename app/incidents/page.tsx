'use client';

import { useState } from 'react';
import { PrivatizationIncidentsTable } from '@/components/incidents/PrivatizationIncidentsTable';
import { usePrivatizationIncidents } from '@/lib/hooks/usePrivatizationIncidents';
import { INCIDENT_FILTERS } from '@/lib/utils/privatizationIncidents';
import type { PrivatizationIncidentFilter } from '@/lib/types/privatizationIncidents';

export default function IncidentsPage() {
  const [filter, setFilter] = useState<PrivatizationIncidentFilter>('open');
  const { data, isLoading, error } = usePrivatizationIncidents(filter);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Incidents de paiement</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Privatisations : remboursements en échec, IBAN attendus, paiements après annulation et virements non rattachés
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2" role="tablist" aria-label="Filtrer les incidents">
          {INCIDENT_FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f.value ? 'bg-[#FF6B35] text-white' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {isLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-600 py-8 text-center">{error.message}</p>
          ) : (
            <PrivatizationIncidentsTable incidents={data ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}
