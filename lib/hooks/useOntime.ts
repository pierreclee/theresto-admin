'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideOntimeReportAction,
  getOntimeOverviewAction,
  getOntimePendingCountAction,
  getOntimeSanctionsSwitchAction,
  liftOntimeSanctionAction,
  listOntimeReportsAction,
  setOntimeSanctionsAction,
  voidOntimeReportAction,
  withdrawOntimeAction,
} from '@/lib/actions/ontime';
import { ActionError, unwrapAction } from '@/lib/api/actionResult';
import { verifyTotpCode } from '@/lib/auth/verifyTotp';
import { useToast } from '@/components/shared/Toaster';
import type { OntimeReportFilter } from '@/lib/types/ontime';

/** Exception de l'action serveur elle-même (session expirée…) : message lisible, jamais le brut. */
function readFailure(fallback: string) {
  return (error: unknown): never => {
    if (error instanceof ActionError) throw error;
    console.error('[ontime] lecture impossible', error);
    throw new ActionError('Session expirée. Reconnectez-vous puis rechargez la page.', 'unauthenticated');
  };
}

export function useOntimeReports(status: OntimeReportFilter, offset: number) {
  return useQuery({
    queryKey: ['ontime', 'reports', status, offset],
    queryFn: () =>
      unwrapAction(listOntimeReportsAction(status, offset)).catch(readFailure('Impossible de charger les signalements.')),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useOntimeOverview(restaurantId: string) {
  return useQuery({
    queryKey: ['ontime', 'overview', restaurantId],
    queryFn: () => unwrapAction(getOntimeOverviewAction(restaurantId)).catch(readFailure('Impossible de charger le suivi OnTime.')),
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
  });
}

/** Contestations à trancher (badge) ; aucune requête si `enabled` est faux (hors session admin). */
export function useOntimePendingCount(enabled: boolean): number {
  const { data } = useQuery({
    queryKey: ['ontime', 'pendingCount'],
    enabled,
    queryFn: () => unwrapAction(getOntimePendingCountAction()).catch(readFailure('Impossible de compter les contestations.')),
    staleTime: 60 * 1000,
  });
  return data ?? 0;
}

export function useOntimeSanctionsSwitch() {
  return useQuery({
    queryKey: ['ontime', 'switch'],
    queryFn: () => unwrapAction(getOntimeSanctionsSwitchAction()).catch(readFailure('Impossible de lire l’interrupteur.')),
    staleTime: 30 * 1000,
  });
}

/**
 * Écriture : code TOTP vérifié dans le navigateur (session AAL2 avec un facteur récent), puis
 * action serveur, qui revérifie le facteur de moins de 5 minutes. Toutes les lectures OnTime
 * et les alertes sont rechargées ensuite, même en cas d'erreur (un conflit = écran périmé).
 */
function useOntimeMutation<I, R>(
  run: (input: I) => Promise<{ ok: true; data: R } | { ok: false; code?: string; error: string }>,
  success: (data: R, input: I) => string,
) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ totpCode, ...input }: I & { totpCode: string }) => {
      await verifyTotpCode(totpCode);
      const result = await run(input as unknown as I).catch((error: unknown) => {
        console.error('[ontime] écriture impossible', error);
        return { ok: false as const, code: 'internal', error: "L'action a échoué. Rechargez la page puis réessayez." };
      });
      if (!result.ok) throw new ActionError(result.error, result.code);
      return result.data;
    },
    onSuccess: (data, input) => toast(success(data, input as unknown as I)),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ontime'] }),
        queryClient.invalidateQueries({ queryKey: ['restaurantAlerts'] }),
      ]),
  });
}

export function useDecideOntimeReport() {
  return useOntimeMutation(decideOntimeReportAction, (data, input) => {
    if (input.decision === 'dismissed') return 'Signalement écarté';
    if (data.sanction) {
      return data.sanction.kind === 'suspension'
        ? 'Manquement retenu : OnTime suspendue 14 jours'
        : 'Manquement retenu : avertissement envoyé';
    }
    return 'Manquement retenu';
  });
}

export function useVoidOntimeReport() {
  return useOntimeMutation(voidOntimeReportAction, () => 'Manquement annulé');
}

export function useWithdrawOntime() {
  return useOntimeMutation(withdrawOntimeAction, () => 'OnTime retirée au restaurant');
}

export function useLiftOntimeSanction() {
  return useOntimeMutation(liftOntimeSanctionAction, (data) =>
    data.sanction.kind === 'withdrawal' ? 'OnTime rétablie' : 'Suspension levée');
}

export function useSetOntimeSanctions() {
  return useOntimeMutation(setOntimeSanctionsAction, (data) =>
    data.enabled ? 'Sanctions OnTime automatiques allumées' : 'Sanctions OnTime automatiques éteintes');
}
