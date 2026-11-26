'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  declineRestaurantAccessRequestAction,
  listRestaurantAccessRequestsAction,
} from '@/lib/actions/accessRequests';
import { ActionError, unwrapAction } from '@/lib/api/actionResult';
import type { AccessRequestFilter } from '@/lib/types/accessRequests';

export const ACCESS_REQUESTS_QUERY_KEY = ['restaurantAccessRequests'] as const;

/** Exception de l'action serveur elle-même (session expirée…) : message lisible, jamais le brut. */
function failure(error: unknown): never {
  if (error instanceof ActionError) throw error;
  console.error('[demandes] action impossible', error);
  throw new ActionError('Session expirée. Reconnectez-vous puis rechargez la page.', 'unauthenticated');
}

export function useRestaurantAccessRequests(filter: AccessRequestFilter) {
  return useQuery({
    queryKey: [...ACCESS_REQUESTS_QUERY_KEY, filter],
    queryFn: () => unwrapAction(listRestaurantAccessRequestsAction(filter)).catch(failure),
    staleTime: 30 * 1000,
  });
}

/** Refus d'une demande ; la liste est rechargée ensuite, même en cas d'erreur (demande déjà traitée). */
export function useDeclineRestaurantAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => unwrapAction(declineRestaurantAccessRequestAction(requestId)).catch(failure),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_QUERY_KEY }),
  });
}

/** Après une invitation (admin-onboarding passe la demande à « invited ») : liste rechargée. */
export function useRefreshAccessRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_QUERY_KEY });
}
