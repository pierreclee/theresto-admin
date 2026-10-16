'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSubscriptionPricesAction,
  updateSubscriptionPriceAction,
} from '@/lib/actions/subscriptionPrices';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/shared/Toaster';
import type { PaidPlan, SubscriptionPriceInfo } from '@/lib/types/config';

export const PLAN_LABELS: Record<PaidPlan, string> = {
  croissance: 'Croissance',
  liberte: 'Liberté',
};

export function formatPlanPrice(price: Pick<SubscriptionPriceInfo, 'amount' | 'currency'>): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
  }).format(price.amount);
}

export function useSubscriptionPrices() {
  return useQuery({
    queryKey: ['subscriptionPrices'],
    queryFn: async () => {
      const result = await getSubscriptionPricesAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    staleTime: 60 * 1000,
  });
}

/** Message affiché à l'admin pour une erreur de l'Edge Function. */
function priceUpdateErrorMessage(code: string | undefined, error: string): string {
  if (code === 'permission-denied') {
    return 'Vérification en deux étapes expirée ou droits insuffisants. Saisissez un nouveau code.';
  }
  if (code === 'failed-precondition') {
    return 'Le prix a été modifié entre-temps. Rechargez la page et recommencez.';
  }
  if (code === 'invalid-argument') {
    return 'Montant invalide (entre 1 et 10 000 €, 2 décimales maximum).';
  }
  return error || 'Erreur lors de la mise à jour du prix';
}

/**
 * Change le prix d'un plan : vérifie d'abord le code TOTP (la session passe en
 * AAL2 avec un facteur récent), puis demande la modification à l'Edge Function,
 * qui revérifie ce facteur côté serveur.
 */
export function useUpdateSubscriptionPrice() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      plan,
      amount,
      expectedPriceId,
      totpCode,
    }: {
      plan: PaidPlan;
      amount: number;
      expectedPriceId: string;
      totpCode: string;
    }) => {
      const supabase = createClient();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw new Error(factorsError.message);
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (!totp) throw new Error('Aucune application d\'authentification configurée pour ce compte');

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totp.id,
        code: totpCode,
      });
      if (verifyError) throw new Error('Code de vérification invalide');

      const result = await updateSubscriptionPriceAction(plan, amount, expectedPriceId);
      if (!result.ok) throw new Error(priceUpdateErrorMessage(result.code, result.error));
      return result.data;
    },
    onSuccess: (price) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionPrices'] });
      toast(`Prix ${PLAN_LABELS[price.plan]} mis à jour : ${formatPlanPrice(price)} / mois`);
    },
  });
}
