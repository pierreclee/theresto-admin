'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAppVersionPoliciesAction, updateAppVersionPolicyAction } from '@/lib/actions/appVersionSettings';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { useToast } from '@/components/shared/Toaster';
import { ActionError } from '@/lib/api/actionResult';
import { appVersionErrorMessage } from '@/lib/utils/appVersion';
import type { AppVersionPolicyInput } from '@/lib/types/appVersion';

const QUERY_KEY = ['appVersionPolicies'];

export function useAppVersionPolicies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      // Un échec de l'action serveur elle-même (ex. session admin expirée) arrive en exception.
      const result = await getAppVersionPoliciesAction().catch((e: unknown) => {
        console.error('[versions] lecture impossible', e);
        return null;
      });
      if (!result?.ok) {
        throw new Error(
          result?.code === 'unauthenticated'
            ? 'Session expirée. Reconnectez-vous puis rechargez la page.'
            : 'Impossible de charger les versions de l’app.',
        );
      }
      return result.data.policies;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Modification d'une plateforme : code TOTP vérifié d'abord (l'Edge Function exige un
 * second facteur de moins de 5 min), puis l'action serveur. Lève une ActionError (message en
 * français, code de l'Edge Function) ; les versions sont relues même en cas d'erreur.
 */
export function useUpdateAppVersionPolicy() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ totpCode, ...input }: AppVersionPolicyInput & { totpCode: string }) => {
      await verifyTotpCode(totpCode);
      const result = await updateAppVersionPolicyAction(input);
      if (!result.ok) throw new ActionError(appVersionErrorMessage(result.code), result.code);
      return result.data;
    },
    onSuccess: () => toast('Versions de l’app mises à jour'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
