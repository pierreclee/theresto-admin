// lib/hooks/useBilling.ts
'use client';

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  backfillPlatformRevenueAction,
  getRevenueSummaryAction,
  getStripeOverviewAction,
} from '@/lib/actions/billing';

/** Message affiché quand une lecture échoue (jamais le message brut, en anglais). */
function billingReadErrorMessage(code: string | undefined, fallback: string): string {
  if (code === 'unauthenticated') return 'Session expirée. Reconnectez-vous puis rechargez la page.';
  if (code === 'not-found') return 'Restaurant introuvable.';
  return fallback;
}

function logReadFailure(error: unknown): null {
  console.error('[billing] lecture impossible', error);
  return null;
}

export function useStripeOverview(restaurantId: string) {
  return useQuery({
    queryKey: ['stripeOverview', restaurantId],
    queryFn: async () => {
      const result = await getStripeOverviewAction(restaurantId).catch(logReadFailure);
      if (!result?.ok) {
        throw new Error(billingReadErrorMessage(result?.code, 'Impossible de lire les données Stripe.'));
      }
      return result.data;
    },
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
  });
}

export function useRevenueSummary(restaurantId: string) {
  return useQuery({
    queryKey: ['revenueSummary', restaurantId],
    queryFn: async () => {
      const result = await getRevenueSummaryAction(restaurantId).catch(logReadFailure);
      if (!result?.ok) {
        throw new Error(billingReadErrorMessage(result?.code, 'Impossible de charger les revenus.'));
      }
      return result.data;
    },
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
  });
}

/** Message affiché quand la reprise échoue (jamais le message brut, en anglais). */
function backfillErrorMessage(code: string | undefined): string {
  if (code === 'unauthenticated') return 'Session expirée. Reconnectez-vous puis recommencez.';
  if (code === 'permission-denied') return 'Droits insuffisants.';
  return 'Reprise impossible. Réessayez ou consultez les logs de migration-tools.';
}

function logBackfillFailure(error: unknown): null {
  console.error('[billing] reprise impossible', error);
  return null;
}

export function useBackfillPlatformRevenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await backfillPlatformRevenueAction().catch(logBackfillFailure);
      if (!result?.ok) {
        if (result) console.error('[billing] reprise impossible', result.error);
        throw new Error(backfillErrorMessage(result?.code));
      }
      return result.data.counts;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['revenueSummary'] }),
  });
}
