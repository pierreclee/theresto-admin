'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getRestaurantRechargesAction,
  listDisputesAction,
  listIncidentCommissionRefundsAction,
} from '@/lib/actions/disputes';
import { ActionError, unwrapAction } from '@/lib/api/actionResult';
import type { DisputeFilter } from '@/lib/types/disputes';

/** Exception de l'action serveur elle-même (session expirée…) : message lisible, jamais le brut. */
function readFailure(error: unknown): never {
  if (error instanceof ActionError) throw error;
  console.error('[litiges] lecture impossible', error);
  throw new ActionError('Session expirée. Reconnectez-vous puis rechargez la page.', 'unauthenticated');
}

export function useDisputes(filter: DisputeFilter) {
  return useQuery({
    queryKey: ['disputes', filter],
    queryFn: () => unwrapAction(listDisputesAction(filter)).catch(readFailure),
    staleTime: 60 * 1000,
  });
}

export function useRestaurantRecharges(restaurantId: string) {
  return useQuery({
    queryKey: ['restaurantRecharges', restaurantId],
    queryFn: () => unwrapAction(getRestaurantRechargesAction(restaurantId)).catch(readFailure),
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
  });
}

export function useIncidentCommissionRefunds() {
  return useQuery({
    queryKey: ['incidentCommissionRefunds'],
    queryFn: () => unwrapAction(listIncidentCommissionRefundsAction()).catch(readFailure),
    staleTime: 60 * 1000,
  });
}
