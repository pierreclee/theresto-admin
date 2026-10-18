'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useBackfillPlatformRevenue } from '@/lib/hooks/useBilling';
import { REVENUE_CATEGORY_LABELS, REVENUE_CATEGORY_ORDER } from '@/lib/utils/billing';
import type { BackfillCounts } from '@/lib/types/billing';

/** Configuration : reconstruit le registre des revenus depuis Stripe (idempotent). */
export function RevenueBackfillCard() {
  const { mutateAsync, isPending } = useBackfillPlatformRevenue();
  const [counts, setCounts] = useState<BackfillCounts | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    try {
      setCounts(await mutateAsync());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">Registre des revenus</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Reprend depuis Stripe les factures payées, frais de plateforme et frais mensuels. Sans risque de doublon.
        </p>
      </div>
      <div className="p-5 space-y-3">
        <button
          onClick={run}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Reprise en cours…' : 'Reconstruire le registre des revenus'}
        </button>
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle size={14} /> {error}
          </p>
        )}
        {counts && (
          <ul className="text-sm text-gray-600 space-y-0.5">
            {REVENUE_CATEGORY_ORDER.map((category) => (
              <li key={category}>
                {REVENUE_CATEGORY_LABELS[category]} : {counts[category].recorded} enregistrée(s)
                {counts[category].unresolved > 0 && `, dont ${counts[category].unresolved} sans restaurant`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
