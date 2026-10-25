'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCommissionSettingsAction,
  getRestaurantCommissionAction,
  resetRestaurantCommissionRatesAction,
  setRestaurantOnlineRateAction,
  setRestaurantPrivatizationRateAction,
  updateGlobalCommissionRatesAction,
  updateGlobalOnlineRatesAction,
  updateGlobalPrivatizationRatesAction,
  updateRestaurantCommissionRatesAction,
} from '@/lib/actions/commissionSettings';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { useToast } from '@/components/shared/Toaster';
import { COMMISSION_CONFLICT_MESSAGE, CommissionMutationError } from '@/lib/utils/commissionRates';

/** Le tarif est modifié mais l'écriture dans platform_logs a échoué (auditLogged=false). */
const AUDIT_NOT_LOGGED_MESSAGE =
  "Le tarif a bien été modifié, mais la modification n'a pas pu être journalisée. Prévenez l'équipe technique.";

/** Message affiché à l'admin pour une erreur de l'Edge Function. */
function commissionErrorMessage(code: string | undefined, error: string): string {
  if (code === 'unauthenticated') {
    return 'Session expirée. Reconnectez-vous puis recommencez.';
  }
  if (code === 'permission-denied') {
    return 'Vérification en deux étapes expirée ou droits insuffisants. Saisissez un nouveau code.';
  }
  if (code === 'failed-precondition') {
    return COMMISSION_CONFLICT_MESSAGE;
  }
  if (code === 'invalid-argument') {
    return 'Valeurs invalides.';
  }
  if (code === 'not-found') {
    return 'Restaurant introuvable.';
  }
  return error || 'Erreur lors de la mise à jour du tarif';
}

/** Message affiché quand le chargement des commissions échoue (jamais le message brut, en anglais). */
const READ_ERROR_MESSAGE = 'Impossible de charger les commissions.';

function commissionReadErrorMessage(code: string | undefined): string {
  if (code === 'unauthenticated') {
    return 'Session expirée. Reconnectez-vous puis rechargez la page.';
  }
  if (code === 'not-found') {
    return 'Restaurant introuvable.';
  }
  return READ_ERROR_MESSAGE;
}

function logReadFailure(error: unknown): null {
  console.error('[commissions] lecture impossible', error);
  return null;
}

export function useCommissionSettings() {
  return useQuery({
    queryKey: ['commissionSettings'],
    queryFn: async () => {
      // Un échec de l'action serveur elle-même (ex. session admin expirée) arrive en exception.
      const result = await getCommissionSettingsAction().catch(logReadFailure);
      if (!result?.ok) throw new Error(commissionReadErrorMessage(result?.code));
      return result.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useRestaurantCommission(restaurantId: string) {
  return useQuery({
    queryKey: ['restaurantCommission', restaurantId],
    queryFn: async () => {
      // Un échec de l'action serveur elle-même (ex. session admin expirée) arrive en exception.
      const result = await getRestaurantCommissionAction(restaurantId).catch(logReadFailure);
      if (!result?.ok) throw new Error(commissionReadErrorMessage(result?.code));
      return result.data.commission;
    },
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
  });
}

// Les requêtes sont invalidées même en cas d'erreur (onSettled) : un conflit
// de concurrence signifie que les données affichées sont périmées. onSettled
// renvoie la promesse du rechargement, que mutateAsync attend avant de rendre
// la main : après un conflit, le formulaire repart des valeurs à jour.

export function useUpdateGlobalCommissionRates() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      totpCode,
      ...input
    }: {
      tableFeeHt: number;
      guestFeeHt: number;
      minInvoiceHt: number;
      maxCarryMonths: number;
      expectedUpdatedAt: string;
      totpCode: string;
    }) => {
      await verifyTotpCode(totpCode);
      const result = await updateGlobalCommissionRatesAction(input);
      if (!result.ok) {
        throw new CommissionMutationError(commissionErrorMessage(result.code, result.error), result.code);
      }
      return result.data;
    },
    onSuccess: ({ auditLogged }) => {
      if (!auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast('Tarif des commissions mis à jour');
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['commissionSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['restaurantCommission'] }),
      ]),
  });
}

export function useUpdateRestaurantCommissionRates(restaurantId: string) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      totpCode,
      ...input
    }: {
      tableFeeHt: number;
      guestFeeHt: number;
      expectedUpdatedAt: string | null;
      totpCode: string;
    }) => {
      await verifyTotpCode(totpCode);
      const result = await updateRestaurantCommissionRatesAction({ restaurantId, ...input });
      if (!result.ok) {
        throw new CommissionMutationError(commissionErrorMessage(result.code, result.error), result.code);
      }
      return result.data;
    },
    onSuccess: ({ auditLogged }) => {
      if (!auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast('Tarif personnalisé enregistré');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['restaurantCommission', restaurantId] }),
  });
}

export function useResetRestaurantCommissionRates(restaurantId: string) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ totpCode, expectedUpdatedAt }: { totpCode: string; expectedUpdatedAt: string | null }) => {
      await verifyTotpCode(totpCode);
      const result = await resetRestaurantCommissionRatesAction({ restaurantId, expectedUpdatedAt });
      if (!result.ok) {
        throw new CommissionMutationError(commissionErrorMessage(result.code, result.error), result.code);
      }
      return result.data;
    },
    onSuccess: ({ auditLogged }) => {
      if (!auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast('Le restaurant suit de nouveau le tarif global');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['restaurantCommission', restaurantId] }),
  });
}

export function useUpdateGlobalOnlineRates() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      totpCode,
      ...input
    }: {
      croissanceRate: number;
      liberteRate: number;
      expectedUpdatedAt: string;
      totpCode: string;
    }) => {
      await verifyTotpCode(totpCode);
      const result = await updateGlobalOnlineRatesAction(input);
      if (!result.ok) {
        throw new CommissionMutationError(commissionErrorMessage(result.code, result.error), result.code);
      }
      return result.data;
    },
    onSuccess: ({ auditLogged }) => {
      if (!auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast('Taux des paiements en ligne mis à jour');
    },
    // Les taux effectifs des restaurants ont pu changer : fiches et listes à recharger.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['commissionSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['restaurantCommission'] }),
        queryClient.invalidateQueries({ queryKey: ['restaurant'] }),
        queryClient.invalidateQueries({ queryKey: ['restaurants'] }),
      ]),
  });
}

export function useSetRestaurantOnlineRate(restaurantId: string) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      totpCode,
      ...input
    }: {
      rate: number | null;
      expectedUpdatedAt: string | null;
      totpCode: string;
    }) => {
      await verifyTotpCode(totpCode);
      const result = await setRestaurantOnlineRateAction({ restaurantId, ...input });
      if (!result.ok) {
        throw new CommissionMutationError(commissionErrorMessage(result.code, result.error), result.code);
      }
      return result.data;
    },
    onSuccess: ({ auditLogged }, { rate }) => {
      if (!auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast(rate === null ? 'Le restaurant suit de nouveau le taux de son plan' : 'Taux particulier enregistré');
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['restaurantCommission', restaurantId] }),
        queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] }),
        queryClient.invalidateQueries({ queryKey: ['restaurants'] }),
      ]),
  });
}

export function useUpdateGlobalPrivatizationRates() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      totpCode,
      ...input
    }: {
      croissanceRate: number;
      liberteRate: number;
      expectedUpdatedAt: string;
      totpCode: string;
    }) => {
      await verifyTotpCode(totpCode);
      const result = await updateGlobalPrivatizationRatesAction(input);
      if (!result.ok) {
        throw new CommissionMutationError(commissionErrorMessage(result.code, result.error), result.code);
      }
      return result.data;
    },
    onSuccess: ({ auditLogged }) => {
      if (!auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast('Taux des privatisations mis à jour');
    },
    // Les taux effectifs des restaurants sans taux particulier ont changé.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['commissionSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['restaurantCommission'] }),
      ]),
  });
}

export function useSetRestaurantPrivatizationRate(restaurantId: string) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      totpCode,
      ...input
    }: {
      rate: number | null;
      expectedUpdatedAt: string | null;
      totpCode: string;
    }) => {
      await verifyTotpCode(totpCode);
      const result = await setRestaurantPrivatizationRateAction({ restaurantId, ...input });
      if (!result.ok) {
        throw new CommissionMutationError(commissionErrorMessage(result.code, result.error), result.code);
      }
      return result.data;
    },
    onSuccess: ({ auditLogged }, { rate }) => {
      if (!auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast(rate === null ? 'Le restaurant suit de nouveau le taux de son plan' : 'Taux particulier enregistré');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['restaurantCommission', restaurantId] }),
  });
}
