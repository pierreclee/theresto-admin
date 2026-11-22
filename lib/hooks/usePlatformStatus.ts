'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMaintenancePeriodsAction,
  getPlatformStatusAction,
  updatePlatformStatusAction,
} from '@/lib/actions/platformStatusSettings';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { useToast } from '@/components/shared/Toaster';
import { ActionError } from '@/lib/api/actionResult';
import {
  isNetworkFailure,
  PLATFORM_STATUS_NETWORK_MESSAGE,
  platformStatusErrorMessage,
} from '@/lib/utils/platformStatus';
import type { PlatformStatusInput } from '@/lib/types/platformStatus';

const STATUS_KEY = ['platformStatus'];
const PERIODS_KEY = ['maintenancePeriods'];

export function usePlatformStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => {
      // Un échec de l'action serveur elle-même (ex. session admin expirée) arrive en exception.
      const result = await getPlatformStatusAction().catch((e: unknown) => {
        console.error('[maintenance] lecture impossible', e);
        return null;
      });
      if (!result?.ok) {
        throw new ActionError(
          result?.code === 'unauthenticated'
            ? 'Session expirée. Reconnectez-vous puis rechargez la page.'
            : 'Impossible de charger l’état de la maintenance.',
          result?.code,
        );
      }
      return result.data.status;
    },
    staleTime: 30 * 1000,
    // Début et fin automatiques : l'état affiché est recalculé à l'écran, et relu chaque minute.
    refetchInterval: 60 * 1000,
  });
}

export function useMaintenancePeriods() {
  return useQuery({
    queryKey: PERIODS_KEY,
    queryFn: async () => {
      const result = await getMaintenancePeriodsAction().catch(() => null);
      if (!result?.ok) throw new ActionError('Historique des maintenances indisponible.', result?.code);
      return result.data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Modification : code TOTP vérifié d'abord (l'Edge Function exige un second facteur de moins
 * de 5 min), puis l'action serveur. Lève une ActionError (message en français, code de l'Edge
 * Function, ou « network » pour une coupure) ; l'état et l'historique sont relus même en cas
 * d'erreur.
 */
export function useUpdatePlatformStatus() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ totpCode, input }: { totpCode: string; input: () => PlatformStatusInput }) => {
      try {
        await verifyTotpCode(totpCode);
        // Saisie construite après la vérification du code : « Maintenant » = heure de l'envoi.
        const result = await updatePlatformStatusAction(input());
        if (!result.ok) throw new ActionError(platformStatusErrorMessage(result.code, result.error), result.code);
        return result.data;
      } catch (e) {
        // Coupure réseau : message en français plutôt que « Failed to fetch ». Un nouvel essai
        // après un enregistrement passé malgré tout donne un conflit, jamais un écrasement.
        if (!(e instanceof ActionError) && isNetworkFailure(e)) {
          throw new ActionError(PLATFORM_STATUS_NETWORK_MESSAGE, 'network');
        }
        throw e;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(STATUS_KEY, data.status);
      toast(data.status.enabled ? 'Maintenance enregistrée' : 'Maintenance désactivée');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: PERIODS_KEY });
    },
  });
}
