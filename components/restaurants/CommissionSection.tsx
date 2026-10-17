'use client';

import { useState } from 'react';
import { AlertTriangle, ExternalLink, Pencil, RotateCcw } from 'lucide-react';
import { CommissionRatesModal } from '@/components/config/CommissionRatesModal';
import {
  useResetRestaurantCommissionRates,
  useRestaurantCommission,
  useUpdateRestaurantCommissionRates,
} from '@/lib/hooks/useCommissionSettings';
import { INVOICE_STATUS_LABELS, formatEuro, formatPeriod, isEssentielPlan } from '@/lib/utils/commissionRates';

/** Fiche restaurant : tarif des commissions (personnalisable sous 2FA) et factures. */
export function CommissionSection({ restaurantId }: { restaurantId: string }) {
  const { data: commission, isPending, error } = useRestaurantCommission(restaurantId);
  const update = useUpdateRestaurantCommissionRates(restaurantId);
  const reset = useResetRestaurantCommissionRates(restaurantId);
  const [modal, setModal] = useState<'edit' | 'reset' | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Commissions de réservation</h3>
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {error.message}
        </div>
      ) : isPending || !commission ? (
        <div className="px-5 py-4 animate-pulse space-y-2">
          <div className="h-4 w-56 bg-gray-100 rounded" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {formatEuro(commission.tableFeeHt)} HT / table + {formatEuro(commission.guestFeeHt)} HT / couvert
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {commission.isCustom ? 'Tarif personnalisé' : 'Tarif global'}
                {!isEssentielPlan(commission.subscriptionPlan) &&
                  ' · sans effet tant que le restaurant a un plan payant'}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setModal('edit')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 transition-colors"
              >
                <Pencil size={12} />
                {commission.isCustom ? 'Modifier' : 'Personnaliser'}
              </button>
              {commission.isCustom && (
                <button
                  onClick={() => setModal('reset')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw size={12} />
                  Revenir au tarif global
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`px-2 py-1 rounded-lg border ${
                commission.paymentMethodReady
                  ? 'bg-green-50 border-green-100 text-green-700'
                  : 'bg-amber-50 border-amber-100 text-amber-700'
              }`}
            >
              {commission.paymentMethodReady ? 'Moyen de paiement enregistré' : 'Aucun moyen de paiement'}
            </span>
            {commission.suspended && (
              <span className="px-2 py-1 rounded-lg border bg-red-50 border-red-100 text-red-700">
                Réservation en ligne suspendue (impayé)
              </span>
            )}
          </div>

          {commission.invoices.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune facture de commissions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="font-medium py-1">Mois</th>
                  <th className="font-medium py-1 text-right">Réservations</th>
                  <th className="font-medium py-1 text-right">Montant HT</th>
                  <th className="font-medium py-1 text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {commission.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-gray-50">
                    <td className="py-1.5 capitalize">{formatPeriod(invoice.period)}</td>
                    <td className="py-1.5 text-right">{invoice.bookingCount}</td>
                    <td className="py-1.5 text-right">{formatEuro(invoice.amountHt)}</td>
                    <td className="py-1.5 text-right">
                      {invoice.hostedInvoiceUrl?.startsWith('https://') ? (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[#FF6B35]"
                        >
                          {INVOICE_STATUS_LABELS[invoice.status]}
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        INVOICE_STATUS_LABELS[invoice.status]
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal === 'edit' && commission && (
        <CommissionRatesModal
          title="Tarif personnalisé du restaurant"
          fields={[
            { key: 'tableFeeHt', label: 'Par table réservée', initial: commission.tableFeeHt, kind: 'euro' },
            { key: 'guestFeeHt', label: 'Par couvert', initial: commission.guestFeeHt, kind: 'euro' },
          ]}
          warning="Remplace le tarif global pour ce restaurant, à partir des réservations comptabilisées dès maintenant."
          confirmLabel="Enregistrer le tarif"
          unchangedConfirmation={
            commission.isCustom
              ? undefined
              : {
                  notice: 'Tarif figé pour ce restaurant : il ne suivra plus les changements du tarif global.',
                  confirmLabel: 'Figer le tarif',
                }
          }
          onConfirm={async (values, totpCode) => {
            await update.mutateAsync({
              tableFeeHt: values.tableFeeHt,
              guestFeeHt: values.guestFeeHt,
              expectedUpdatedAt: commission.updatedAt,
              totpCode,
            });
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'reset' && commission && (
        <CommissionRatesModal
          title="Revenir au tarif global"
          fields={[]}
          warning="Le restaurant suivra de nouveau le tarif global pour les prochaines réservations comptabilisées."
          confirmLabel="Revenir au tarif global"
          onConfirm={async (_values, totpCode) => {
            await reset.mutateAsync({ expectedUpdatedAt: commission.updatedAt, totpCode });
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
