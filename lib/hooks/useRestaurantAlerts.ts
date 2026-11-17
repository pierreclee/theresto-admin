'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAlertSettingsAction,
  getPendingLapseDetailAction,
  getRestaurantAlertsAction,
  updateAlertSettingsAction,
} from '@/lib/actions/restaurantAlerts';
import { ActionError, unwrapAction } from '@/lib/api/actionResult';
import { useToast } from '@/components/shared/Toaster';
import type { RestaurantAlertSettingsInput } from '@/lib/types/restaurantAlerts';

/**
 * Exception de l'action serveur elle-même (session admin expirée, AAL2…) : message lisible,
 * jamais le message brut (masqué en production).
 */
function readFailure(fallback: string) {
  return (error: unknown): never => {
    if (error instanceof ActionError) throw error;
    console.error('[alertes] lecture impossible', error);
    throw new ActionError(fallback);
  };
}

/** Alertes de tous les restaurants (restaurantId absent) ou d'un seul. */
export function useRestaurantAlerts(restaurantId?: string) {
  return useQuery({
    queryKey: ['restaurantAlerts', restaurantId ?? null],
    queryFn: () =>
      unwrapAction(getRestaurantAlertsAction(restaurantId ?? null)).catch(readFailure('Impossible de charger les alertes.')),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePendingLapseDetail(restaurantId: string, offset: number) {
  return useQuery({
    queryKey: ['pendingLapseDetail', restaurantId, offset],
    queryFn: () =>
      unwrapAction(getPendingLapseDetailAction(restaurantId, offset))
        .catch(readFailure('Impossible de charger les demandes non confirmées.')),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useAlertSettings() {
  return useQuery({
    queryKey: ['restaurantAlertSettings'],
    queryFn: () => unwrapAction(getAlertSettingsAction()).catch(readFailure('Impossible de charger les seuils d’alerte.')),
    staleTime: 60 * 1000,
  });
}

/**
 * Modification des seuils. Les lectures qui dépendent des seuils (alertes, fiches) sont
 * rechargées même en cas d'erreur : un conflit signifie que l'écran est périmé.
 */
export function useUpdateAlertSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, expectedUpdatedAt }: { values: RestaurantAlertSettingsInput; expectedUpdatedAt: string }) => {
      const result = await updateAlertSettingsAction(values, expectedUpdatedAt).catch((error: unknown) => {
        console.error('[alertes] modification impossible', error);
        return { ok: false as const, code: 'internal', error: 'Modification des seuils impossible. Réessayez.' };
      });
      if (!result.ok) throw new ActionError(result.error, result.code);
      return result.data;
    },
    onSuccess: ({ changed }) => toast(changed ? 'Seuils d’alerte mis à jour' : 'Aucune valeur modifiée'),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['restaurantAlertSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['restaurantAlerts'] }),
        queryClient.invalidateQueries({ queryKey: ['pendingLapseDetail'] }),
      ]),
  });
}
