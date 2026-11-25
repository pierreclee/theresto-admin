'use client';

import { useState } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { AccessRequestsTable } from '@/components/accessRequests/AccessRequestsTable';
import { useRestaurantAccessRequests } from '@/lib/hooks/useAccessRequests';
import { actionErrorMessage } from '@/lib/api/actionResult';
import type { AccessRequestFilter } from '@/lib/types/accessRequests';

const FILTERS: { value: AccessRequestFilter; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'invited', label: 'Invitées' },
  { value: 'declined', label: 'Refusées' },
  { value: 'all', label: 'Toutes' },
];

// Demandes d'ouverture d'un espace restaurant faites depuis le Hub ou l'App par un compte sans
// restaurant (contrat : docs/features/onboarding-accompagne.md du dépôt de l'app).
export default function AccessRequestsPage() {
  const [filter, setFilter] = useState<AccessRequestFilter>('pending');
  const { data, isPending, error } = useRestaurantAccessRequests(filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Inbox size={20} className="text-[#FF6B35]" />
            <h2 className="text-xl font-bold text-gray-900">Demandes d’espace restaurant</h2>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            Comptes sans restaurant qui demandent l’ouverture de leur espace. Recontactez la personne, puis invitez-la
            (par e-mail ou en parcours accompagné) : la demande passe alors à « Invitée ». Une demande n’ouvre rien
            d’elle-même. Conservation : 12 mois après la demande ou son traitement.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Filtrer les demandes">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f.value ? 'bg-[#FF6B35] text-white' : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <section className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-5">
          {error ? (
            <p role="alert" className="text-sm text-red-600 py-6 text-center flex items-center justify-center gap-2">
              <AlertTriangle size={15} />
              {actionErrorMessage(error, 'Impossible de charger les demandes.')}
            </p>
          ) : isPending ? (
            <p className="text-sm text-gray-400 py-6 text-center">Chargement…</p>
          ) : (
            <AccessRequestsTable requests={data?.requests ?? []} />
          )}
        </div>
      </section>

      {data?.truncated && <p className="text-xs text-gray-400">Liste limitée aux 500 demandes les plus récentes.</p>}
    </div>
  );
}
