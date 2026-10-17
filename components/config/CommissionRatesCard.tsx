'use client';

import { useState } from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import { CommissionRatesModal } from '@/components/config/CommissionRatesModal';
import { useCommissionSettings, useUpdateGlobalCommissionRates } from '@/lib/hooks/useCommissionSettings';
import { formatEuro, formatPeriod } from '@/lib/utils/commissionRates';

/** Tarif global des commissions du plan Essentiel + totaux mensuels facturés. */
export function CommissionRatesCard() {
  const { data, isPending, error } = useCommissionSettings();
  const { mutateAsync } = useUpdateGlobalCommissionRates();
  const [editing, setEditing] = useState(false);
  const settings = data?.settings;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Commissions plan Essentiel</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Réservations de table apportées par TheResto (app et widget), facturées chaque mois. Toute
            modification exige une vérification en deux étapes.
          </p>
        </div>
        {settings && !error && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 transition-colors flex-shrink-0"
          >
            <Pencil size={12} />
            Modifier
          </button>
        )}
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {error.message}
        </div>
      ) : isPending || !settings ? (
        <div className="p-5 grid grid-cols-2 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 p-5">
            {[
              ['Par table réservée', `${formatEuro(settings.tableFeeHt)} HT`],
              ['Par couvert', `${formatEuro(settings.guestFeeHt)} HT`],
              ['Facture minimale', `${formatEuro(settings.minInvoiceHt)} HT`],
              ['Report maximal', `${settings.maxCarryMonths} mois`],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="text-sm font-semibold text-gray-900 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="px-5 pb-5">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">12 derniers mois</h4>
            {data.totals.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune facture de commissions.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="font-medium py-1">Mois</th>
                    <th className="font-medium py-1 text-right">Facturé HT</th>
                    <th className="font-medium py-1 text-right">Encaissé HT</th>
                    <th className="font-medium py-1 text-right">Factures</th>
                  </tr>
                </thead>
                <tbody>
                  {data.totals.map((total) => (
                    <tr key={total.period} className="border-t border-gray-50">
                      <td className="py-1.5 capitalize">{formatPeriod(total.period)}</td>
                      <td className="py-1.5 text-right">{formatEuro(total.invoicedHt)}</td>
                      <td className="py-1.5 text-right">{formatEuro(total.paidHt)}</td>
                      <td className="py-1.5 text-right">{total.invoiceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {editing && settings && (
        <CommissionRatesModal
          title="Tarif global des commissions"
          fields={[
            { key: 'tableFeeHt', label: 'Par table réservée', initial: settings.tableFeeHt, kind: 'euro' },
            { key: 'guestFeeHt', label: 'Par couvert', initial: settings.guestFeeHt, kind: 'euro' },
            { key: 'minInvoiceHt', label: 'Facture minimale', initial: settings.minInvoiceHt, kind: 'euro', max: 1000 },
            { key: 'maxCarryMonths', label: 'Report maximal', initial: settings.maxCarryMonths, kind: 'months' },
          ]}
          warning="S'applique aux réservations comptabilisées à partir de maintenant, pour tous les restaurants sans tarif personnalisé. Les réservations déjà comptabilisées gardent leur tarif."
          confirmLabel="Confirmer le nouveau tarif"
          onConfirm={async (values, totpCode) => {
            await mutateAsync({
              tableFeeHt: values.tableFeeHt,
              guestFeeHt: values.guestFeeHt,
              minInvoiceHt: values.minInvoiceHt,
              maxCarryMonths: values.maxCarryMonths,
              expectedUpdatedAt: settings.updatedAt,
              totpCode,
            });
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
