'use client';

import { AlertTriangle } from 'lucide-react';
import { DisputesTable, StripeLink } from '@/components/disputes/DisputesTable';
import { useRestaurantRecharges } from '@/lib/hooks/useDisputes';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { formatDay, formatInstant } from '@/lib/utils/restaurantAlerts';
import {
  formatCents,
  formatMonth,
  INVOICE_STATUS_LABELS,
  RECOVERY_STATUS_LABELS,
  rechargeKindLabel,
} from '@/lib/utils/disputes';

const euro = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

function Title({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{children}</h4>;
}

/** Fiche d'un restaurant : refacturations, reprises des refacturations impayées et litiges (lecture). */
export function RechargesSection({ restaurantId }: { restaurantId: string }) {
  const { data, isPending, error } = useRestaurantRecharges(restaurantId);

  return (
    <section aria-labelledby="recharges-title" className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
        <h3 id="recharges-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Refacturations et litiges
        </h3>
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {actionErrorMessage(error, 'Impossible de charger les refacturations.')}
        </div>
      ) : isPending || !data ? (
        <div className="p-5 space-y-2 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
        </div>
      ) : (
        <div className="p-5 space-y-6">
          <div>
            <Title>Refacturations ({data.recharges.length})</Title>
            {data.recharges.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune refacturation.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400">
                      <th className="font-medium py-2 pr-4">Date</th>
                      <th className="font-medium py-2 pr-4">Nature</th>
                      <th className="font-medium py-2 pr-4 text-right">Montant HT</th>
                      <th className="font-medium py-2 pr-4">Mois</th>
                      <th className="font-medium py-2">Facture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recharges.map((r) => (
                      <tr key={r.id} className="border-t border-gray-50 align-top">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {formatInstant(r.occurredAt, false)}
                          {r.bookingDate && <span className="block text-xs text-gray-400">réservation du {formatDay(r.bookingDate)}</span>}
                        </td>
                        <td className="py-2 pr-4">{rechargeKindLabel(r.kind)}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{euro(r.amountHt)}</td>
                        <td className="py-2 pr-4 capitalize">{formatMonth(r.period)}</td>
                        <td className="py-2">
                          {r.invoiceStatus
                            ? `${formatMonth(r.invoicePeriod)} · ${INVOICE_STATUS_LABELS[r.invoiceStatus] ?? r.invoiceStatus}`
                            : 'À facturer'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <Title>Reprises des refacturations impayées ({data.recoveries.length})</Title>
            <p className="text-xs text-gray-400 mb-2">
              Annulation de virements vers le compte Stripe du restaurant, 15 jours après l’échec de la facture ; 5 essais.
            </p>
            {data.recoveries.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune reprise.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400">
                      <th className="font-medium py-2 pr-4">Facture</th>
                      <th className="font-medium py-2 pr-4 text-right">Dû</th>
                      <th className="font-medium py-2 pr-4 text-right">Repris</th>
                      <th className="font-medium py-2 pr-4 text-right">Avoir</th>
                      <th className="font-medium py-2 pr-4">État</th>
                      <th className="font-medium py-2">Essais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recoveries.map((r) => (
                      <tr key={r.invoiceId} className="border-t border-gray-50 align-top">
                        <td className="py-2 pr-4">
                          <span className="capitalize">{formatMonth(r.invoicePeriod)}</span>
                          <span className="block"><StripeLink id={r.stripeInvoiceId} livemode={data.livemode} label="Facture Stripe" /></span>
                        </td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{formatCents(r.dueCents)}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{formatCents(r.recoveredCents)}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap">{formatCents(r.creditedCents)}</td>
                        <td className={`py-2 pr-4 ${r.status === 'failed' ? 'text-red-700 font-medium' : ''}`}>
                          {RECOVERY_STATUS_LABELS[r.status] ?? r.status}
                          {r.lastError && <span className="block text-xs text-gray-400">Dernière erreur : {r.lastError}</span>}
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          {r.attempts}
                          {(r.status === 'pending' || r.status === 'partial') && r.nextAttemptAt && (
                            <span className="block text-xs text-gray-400">prochain le {formatInstant(r.nextAttemptAt)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <Title>Litiges ({data.disputes.length})</Title>
            <DisputesTable disputes={data.disputes} showRestaurant={false} />
          </div>
        </div>
      )}
    </section>
  );
}
