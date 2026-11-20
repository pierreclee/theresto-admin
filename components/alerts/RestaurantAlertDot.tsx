'use client';

import type { RestaurantAlert } from '@/lib/types/restaurantAlerts';
import { alertLabel, severityClasses } from '@/lib/utils/restaurantAlerts';

/**
 * Badge rouge seul (un point, sans texte) d'un restaurant en alerte. Les types sont dits
 * par l'aria-label et l'infobulle : la couleur n'est jamais la seule information.
 */
export function RestaurantAlertDot({ alerts }: { alerts: RestaurantAlert[] | undefined }) {
  if (!alerts || alerts.length === 0) return null;
  const labels = [...new Set(alerts.map((a) => alertLabel(a)))].join(', ');
  return (
    <span
      role="img"
      aria-label={`En alerte : ${labels}`}
      title={`En alerte : ${labels}`}
      className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-100 flex-shrink-0"
    />
  );
}

/** Pastille d'un type d'alerte, colorée selon sa gravité. */
export function AlertKindPill({ alert }: { alert: RestaurantAlert }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityClasses(alert.severity)}`}
    >
      {alertLabel(alert)}
    </span>
  );
}
