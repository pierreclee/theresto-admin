'use client';

import NextLink from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { StripeLink } from '@/components/disputes/DisputesTable';
import { useIncidentCommissionRefunds } from '@/lib/hooks/useDisputes';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { formatInstant } from '@/lib/utils/restaurantAlerts';
import { formatCents, INCIDENT_COMMISSION_LIMIT, INCIDENT_COMMISSION_STATE_LABELS } from '@/lib/utils/disputes';

/** Essais de reprise de cron-capture-retry avant abandon (claim_incident_commission_retries). */
const MAX_ATTEMPTS = 6;

/**
 * Incidents CRM remboursés au client dont la commission à rendre au restaurant (paiement v2)
 * n'est pas encore rendue : reprise automatique en cours, ou abandonnée après 6 essais (à rendre
 * à la main depuis l'application fee dans Stripe).
 */
export function IncidentCommissionRefundsSection() {
  const { data, isPending, error } = useIncidentCommissionRefunds();
  const rows = data?.incidents ?? [];

  return (
    <section aria-labelledby="incident-commission-title" className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 id="incident-commission-title" className="text-sm font-semibold text-gray-900">
          Commissions d’incidents non rendues
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Incidents remboursés au client dont la part de commission due au restaurant n’a pas pu être rendue chez Stripe.
          Reprise automatique toutes les 15 minutes, {MAX_ATTEMPTS} essais à intervalle doublé ; au-delà, à rendre à la main
          depuis l’application fee.
        </p>
      </div>
      <div className="p-5">
        {error ? (
          <p role="alert" className="text-sm text-red-600 py-6 text-center flex items-center justify-center gap-2">
            <AlertTriangle size={15} />
            {actionErrorMessage(error, 'Impossible de charger les incidents.')}
          </p>
        ) : isPending ? (
          <p className="text-sm text-gray-400 py-6 text-center">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune commission en attente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="font-medium py-2 pr-4">Restaurant</th>
                  <th className="font-medium py-2 pr-4 text-right">Commission à rendre</th>
                  <th className="font-medium py-2 pr-4 text-right">Déjà rendue</th>
                  <th className="font-medium py-2 pr-4">État</th>
                  <th className="font-medium py-2 pr-4">Essais</th>
                  <th className="font-medium py-2">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.incidentId} className="border-t border-gray-50 align-top">
                    <td className="py-2.5 pr-4">
                      <NextLink href={`/restaurants/${r.restaurantId}`} className="text-[#FF6B35] hover:underline">
                        {r.restaurantName || 'Restaurant sans nom'}
                      </NextLink>
                      {r.refundAmount !== null && (
                        <span className="block text-xs text-gray-400">
                          Client remboursé de {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(r.refundAmount)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">{formatCents(r.commissionDueCents - r.commissionRefundedCents)}</td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">{formatCents(r.commissionRefundedCents)}</td>
                    <td className={`py-2.5 pr-4 ${r.state === 'abandoned' ? 'text-red-700 font-medium' : ''}`}>
                      {INCIDENT_COMMISSION_STATE_LABELS[r.state]}
                      {r.failedAt && <span className="block text-xs text-gray-400">premier échec le {formatInstant(r.failedAt)}</span>}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {r.attempts} / {MAX_ATTEMPTS}
                      {r.nextAttemptAt && <span className="block text-xs text-gray-400">prochain le {formatInstant(r.nextAttemptAt)}</span>}
                    </td>
                    <td className="py-2.5 space-y-0.5">
                      <span className="block"><StripeLink id={r.applicationFeeId} livemode={data!.livemode} label="Application fee" /></span>
                      <span className="block"><StripeLink id={r.refundStripeId} livemode={data!.livemode} label="Remboursement" /></span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data!.truncated && (
              <p className="text-xs text-gray-400 mt-3" data-testid="incident-commission-truncated">
                Liste limitée aux {INCIDENT_COMMISSION_LIMIT} incidents les plus récents dont la commission n’est pas rendue.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
