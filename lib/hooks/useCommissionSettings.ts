'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCommissionSettingsAction,
  getRestaurantCommissionAction,
  resetRestaurantCommissionRatesAction,
  updateGlobalCommissionRatesAction,
  updateRestaurantCommissionRatesAction,
} from '@/lib/actions/commissionSettings';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { useToast } from '@/components/shared/Toaster';

/**
 * L'Edge Function renvoie `internal` avec ce message quand le tarif a bien été
 * modifié mais que l'écriture dans platform_logs a échoué.
 */
function isAuditLogFailure(code: string | undefined, error: string): boolean {
  return code === 'internal' && error.includes('journalisation');
}

/** Message affiché à l'admin pour une erreur de l'Edge Function. */
function commissionErrorMessage(code: string | undefined, error: string): string {
  if (isAuditLogFailure(code, error)) {
    return "Le tarif a bien été modifié, mais la modification n'a pas pu être journalisée. Prévenez l'équipe technique.";
  }
  if (code === 'unauthenticated') {
    return 'Session expirée. Reconnectez-vous puis recommencez.';
  }
  if (code === 'permission-denied') {
    return 'Vérification en deux étapes expirée ou droits insuffisants. Saisissez un nouveau code.';
  }
  if (code === 'failed-precondition') {
    return 'Le tarif a été modifié entre-temps. Rechargez la page et recommencez.';
  }
  if (code === 'invalid-argument') {
    return 'Montants invalides.';
  }
  if (code === 'not-found') {
    return 'Restaurant introuvable.';
  }
  return error || 'Erreur lors de la mise à jour du tarif';
}

export function useCommissionSettings() {
  return useQuery({
    queryKey: ['commissionSettings'],
    queryFn: async () => {
      const result = await getCommissionSettingsAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useRestaurantCommission(restaurantId: string) {
  return useQuery({
    queryKey: ['restaurantCommission', restaurantId],
    queryFn: async () => {
      const result = await getRestaurantCommissionAction(restaurantId);
      if (!result.ok) throw new Error(result.error);
      return result.data.commission;
    },
    staleTime: 60 * 1000,
  });
}

// Les requêtes sont invalidées même en cas d'erreur (onSettled) : un échec de
// journalisation survient après la modification, et un conflit de concurrence
// signifie que les données affichées sont périmées.

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
      if (!result.ok) throw new Error(commissionErrorMessage(result.code, result.error));
      return result.data;
    },
    onSuccess: () => {
      toast('Tarif des commissions mis à jour');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionSettings'] });
      queryClient.invalidateQueries({ queryKey: ['restaurantCommission'] });
    },
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
      if (!result.ok) throw new Error(commissionErrorMessage(result.code, result.error));
      return result.data;
    },
    onSuccess: () => {
      toast('Tarif personnalisé enregistré');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantCommission', restaurantId] });
    },
  });
}

export function useResetRestaurantCommissionRates(restaurantId: string) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ totpCode, expectedUpdatedAt }: { totpCode: string; expectedUpdatedAt: string | null }) => {
      await verifyTotpCode(totpCode);
      const result = await resetRestaurantCommissionRatesAction({ restaurantId, expectedUpdatedAt });
      if (!result.ok) throw new Error(commissionErrorMessage(result.code, result.error));
      return result.data;
    },
    onSuccess: () => {
      toast('Le restaurant suit de nouveau le tarif global');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantCommission', restaurantId] });
    },
  });
}
