'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listPrivatizationIncidentsAction,
  resolvePrivatizationIncidentAction,
  retryPrivatizationRefundAction,
  returnPrivatizationCustomerBalanceAction,
} from '@/lib/actions/privatizationIncidents';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { useToast } from '@/components/shared/Toaster';
import { formatEuro } from '@/lib/utils/commissionRates';
import type { IncidentMoneyAction, PrivatizationIncidentFilter } from '@/lib/types/privatizationIncidents';

const AUDIT_NOT_LOGGED_MESSAGE =
  "L'action a bien été faite, mais elle n'a pas pu être journalisée. Prévenez l'équipe technique.";

/** Message affiché pour une erreur de l'Edge Function (ses messages métier sont déjà en français). */
export function incidentErrorMessage(code: string | undefined, error: string): string {
  if (code === 'unauthenticated') return 'Session expirée. Reconnectez-vous puis recommencez.';
  if (code === 'permission-denied') {
    return 'Vérification en deux étapes expirée ou droits insuffisants. Saisissez un nouveau code.';
  }
  if (code === 'internal') return "L'action a échoué. Réessayez, ou vérifiez dans Stripe.";
  return error || "L'action a échoué.";
}

export function usePrivatizationIncidents(status: PrivatizationIncidentFilter) {
  return useQuery({
    queryKey: ['privatizationIncidents', status],
    queryFn: async () => {
      // Un échec de l'action serveur elle-même (ex. session admin expirée) arrive en exception.
      const result = await listPrivatizationIncidentsAction(status).catch((e: unknown) => {
        console.error('[incidents] lecture impossible', e);
        return null;
      });
      if (!result?.ok) {
        // Liste refusée faute de journal (RGPD-29, D2) : message tel quel.
        if (result?.code === 'audit-log-failed') throw new Error(result.error);
        throw new Error(
          result?.code === 'unauthenticated'
            ? 'Session expirée. Reconnectez-vous puis rechargez la page.'
            : 'Impossible de charger les incidents.',
        );
      }
      return result.data.incidents;
    },
    staleTime: 30 * 1000,
  });
}

/** Nombre d'incidents ouverts (badge de la barre latérale). */
export function useOpenIncidentCount(): number {
  const { data } = usePrivatizationIncidents('open');
  return data?.length ?? 0;
}

export function useIncidentMoneyAction() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      incidentId,
      action,
      totpCode,
    }: {
      incidentId: string;
      action: IncidentMoneyAction;
      totpCode: string;
    }) => {
      await verifyTotpCode(totpCode);
      const result =
        action === 'retryRefund'
          ? await retryPrivatizationRefundAction(incidentId)
          : await returnPrivatizationCustomerBalanceAction(incidentId);
      if (!result.ok) throw new Error(incidentErrorMessage(result.code, result.error));
      return result.data;
    },
    onSuccess: (data) => {
      if (data.auditLogged === false) {
        toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
        return;
      }
      const amount = data.refundedAmount ?? data.returnedAmount ?? 0;
      if (data.status === 'open') {
        toast(`Le remboursement a de nouveau échoué (statut Stripe : ${data.refundStatus ?? 'inconnu'})`, 'error');
      } else if (amount > 0) {
        toast(`${formatEuro(amount)} renvoyés au client`);
      } else {
        toast('Rien à rembourser : incident marqué traité');
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['privatizationIncidents'] }),
  });
}

export function useResolveIncident() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { incidentId: string; resolution: string; status: 'resolved' | 'ignored' }) => {
      const result = await resolvePrivatizationIncidentAction(input);
      if (!result.ok) throw new Error(incidentErrorMessage(result.code, result.error));
      return result.data;
    },
    onSuccess: (data, { status }) => {
      if (!data.auditLogged) toast(AUDIT_NOT_LOGGED_MESSAGE, 'error');
      else toast(status === 'ignored' ? 'Incident ignoré' : 'Incident marqué traité');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['privatizationIncidents'] }),
  });
}
