'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DisputesTable } from '@/components/disputes/DisputesTable';
import { useDisputes } from '@/lib/hooks/useDisputes';
import { actionErrorMessage } from '@/lib/api/actionResult';
import type { DisputeFilter } from '@/lib/types/disputes';

const FILTERS: { value: DisputeFilter; label: string }[] = [
  { value: 'open', label: 'Ouverts' },
  { value: 'all', label: 'Tous' },
];

export default function DisputesPage() {
  const [filter, setFilter] = useState<DisputeFilter>('open');
  const { data, isPending, error } = useDisputes(filter);
  const booking = data?.disputes.filter((d) => d.scope === 'booking') ?? [];
  const platform = data?.disputes.filter((d) => d.scope === 'platform') ?? [];

  const body = (rows: typeof booking) =>
    error ? (
      <p role="alert" className="text-sm text-red-600 py-6 text-center flex items-center justify-center gap-2">
        <AlertTriangle size={15} />
        {actionErrorMessage(error, 'Impossible de charger les litiges.')}
      </p>
    ) : isPending ? (
      <p className="text-sm text-gray-400 py-6 text-center">Chargement…</p>
    ) : (
      <DisputesTable disputes={rows} />
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Litiges</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Contestations bancaires (Stripe). Un litige perdu sur une réservation est refacturé au restaurant (montant
            contesté et frais) sur sa facture de commissions du mois. Les justificatifs se déposent dans Stripe.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Filtrer les litiges">
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

      <section className="bg-white rounded-xl border border-gray-100 overflow-hidden" aria-labelledby="booking-disputes">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 id="booking-disputes" className="text-sm font-semibold text-gray-900">Paiements de réservation</h3>
          <p className="text-xs text-gray-400 mt-0.5">Précommandes, différences, parts d’invités et empreintes (booking_disputes).</p>
        </div>
        <div className="p-5">{body(booking)}</div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 overflow-hidden" aria-labelledby="platform-disputes">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 id="platform-disputes" className="text-sm font-semibold text-gray-900">Hors réservation</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Factures d’abonnement ou de commissions, commandes sur place, réservations introuvables (platform_disputes) :
            ni refacturation ni e-mail automatique. Ceux dont le restaurant n’a pas été retrouvé ne sont visibles qu’ici.
          </p>
        </div>
        <div className="p-5">{body(platform)}</div>
      </section>

      {data?.truncated && (
        <p className="text-xs text-gray-400">Liste limitée aux 500 litiges les plus récents de chaque type.</p>
      )}
    </div>
  );
}
