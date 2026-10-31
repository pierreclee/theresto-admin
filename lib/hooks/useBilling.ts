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

/** Erreur d'une lecture : le refus faute de journal (RGPD-29, D2) garde son message. */
function billingReadError(result: { code?: string; error: string } | null, fallback: string): Error {
  if (result?.code === 'audit-log-failed') return new Error(result.error);
  return new Error(billingReadErrorMessage(result?.code, fallback));
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
        throw billingReadError(result, 'Impossible de lire les données Stripe.');
      }
      return result.data;
    },
    enabled: !!restaurantId,
    staleTime: 60 * 1000,
    // Lecture en direct depuis Stripe : les erreurs ne doivent pas être relancées automatiquement
    retry: false,
  });
}

export function useRevenueSummary(restaurantId: string) {
  return useQuery({
    queryKey: ['revenueSummary', restaurantId],
    queryFn: async () => {
      const result = await getRevenueSummaryAction(restaurantId).catch(logReadFailure);
      if (!result?.ok) {
        throw billingReadError(result, 'Impossible de charger les revenus.');
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
