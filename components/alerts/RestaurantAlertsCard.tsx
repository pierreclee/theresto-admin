'use client';

import NextLink from 'next/link';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { useRestaurantAlerts } from '@/lib/hooks/useRestaurantAlerts';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { AlertKindPill } from '@/components/alerts/RestaurantAlertDot';
import { groupAlertsByRestaurant } from '@/lib/utils/restaurantAlerts';

/** Tableau de bord : « Restaurants en alerte », puis la liste regroupée par restaurant. */
export function RestaurantAlertsCard() {
  const { data, isPending, error } = useRestaurantAlerts();
  const groups = data ? groupAlertsByRestaurant(data.alerts) : [];
  const count = data?.totalRestaurants ?? 0;

  return (
    <section
      aria-labelledby="restaurant-alerts-title"
      className={`bg-white rounded-xl border overflow-hidden ${count > 0 ? 'border-red-200 ring-1 ring-red-50' : 'border-gray-100'}`}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${count > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
            <ShieldAlert size={20} />
          </div>
          <div className="min-w-0">
            <h3 id="restaurant-alerts-title" className="text-sm font-semibold text-gray-900">Restaurants en alerte</h3>
            <p className="text-xs text-gray-400">Suspensions, impayés, incidents, demandes non confirmées…</p>
          </div>
        </div>
        {data && <p className="text-2xl font-bold text-gray-900" data-testid="alerts-restaurant-count">{count}</p>}
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {actionErrorMessage(error, 'Impossible de charger les alertes.')}
        </div>
      ) : isPending ? (
        <div className="p-5 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
        </div>
      ) : groups.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">Aucun restaurant en alerte.</p>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {groups.map((group) => (
            <li key={group.restaurantId}>
              <NextLink
                href={`/restaurants/${group.restaurantId}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{group.restaurantName || 'Restaurant sans nom'}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {group.alerts.map((alert) => <AlertKindPill key={alert.kind} alert={alert} />)}
                  </div>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
              </NextLink>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.alerts.length && (
        <p className="px-5 py-2 text-xs text-gray-400 border-t border-gray-50">
          {data.alerts.length} alertes affichées sur {data.total}.
        </p>
      )}
    </section>
  );
}
