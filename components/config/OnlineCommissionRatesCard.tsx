'use client';

import { useState } from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import { CommissionRatesModal } from '@/components/config/CommissionRatesModal';
import { useCommissionSettings, useUpdateGlobalOnlineRates } from '@/lib/hooks/useCommissionSettings';
import { formatPercent } from '@/lib/utils/commissionRates';

/** Taux globaux de commission des paiements en ligne (Stripe Connect), par plan. */
export function OnlineCommissionRatesCard() {
  const { data, isPending, error } = useCommissionSettings();
  const { mutateAsync } = useUpdateGlobalOnlineRates();
  const [editing, setEditing] = useState(false);
  const rates = data?.onlineRates;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Commission paiements en ligne</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Prélevée sur chaque paiement en ligne (Stripe Connect), pour les restaurants sans taux particulier.
            Toute modification exige une vérification en deux étapes.
          </p>
        </div>
        {rates && !error && (
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
      ) : isPending || !rates ? (
        <div className="p-5 grid grid-cols-2 gap-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-3 p-5">
          {[
            ['Plan Croissance', formatPercent(rates.croissance)],
            ['Plan Liberté', formatPercent(rates.liberte)],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {editing && rates && (
        <CommissionRatesModal
          title="Taux des paiements en ligne"
          fields={[
            { key: 'croissanceRate', label: 'Plan Croissance', initial: rates.croissance, kind: 'percent' },
            { key: 'liberteRate', label: 'Plan Liberté', initial: rates.liberte, kind: 'percent' },
          ]}
          warning="S'applique aux paiements créés à partir de maintenant, pour tous les restaurants sans taux particulier. Les paiements déjà créés gardent leur commission."
          confirmLabel="Confirmer les nouveaux taux"
          onConfirm={async (values, totpCode) => {
            await mutateAsync({
              croissanceRate: values.croissanceRate,
              liberteRate: values.liberteRate,
              expectedUpdatedAt: rates.updatedAt,
              totpCode,
            });
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
