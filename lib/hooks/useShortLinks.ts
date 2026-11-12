'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShortLinkAction,
  exportShortLinkStatsCsvAction,
  getShortLinkAction,
  getShortLinksOverviewAction,
  getShortLinkStatsAction,
  listShortLinksAction,
  setShortLinkActiveAction,
  updateShortLinkAction,
  updateShortLinkSettingsAction,
} from '@/lib/actions/shortLinks';
import { ActionError, shouldRetryQuery, unwrapAction } from '@/lib/api/actionResult';
import { useToast } from '@/components/shared/Toaster';
import { downloadBlob } from '@/lib/links/browserFiles';
import type { StatsPeriod } from '@/lib/links/linkStats';
import type { ShortLinkFormValues } from '@/lib/types/shortLinks';

// Les messages des actions sont déjà en français (refus de la base traduits côté serveur).
// Une exception de l'action elle-même (session expirée, second facteur) arrive masquée en
// production : message de repli.

const READ_FALLBACK = 'Impossible de charger les liens. Rechargez la page.';

async function read<T>(promise: Promise<{ ok: true; data: T } | { ok: false; code?: string; error: string }>): Promise<T> {
  try {
    return await unwrapAction(promise);
  } catch (e) {
    if (e instanceof ActionError) throw e;
    console.error('[liens] lecture impossible', e);
    throw new Error(READ_FALLBACK);
  }
}

export function useShortLinks() {
  return useQuery({
    queryKey: ['shortLinks'],
    queryFn: () => read(listShortLinksAction()),
    retry: (count: number, e: Error) => shouldRetryQuery(count, e),
    staleTime: 30 * 1000,
  });
}

export function useShortLink(id: string) {
  return useQuery({
    queryKey: ['shortLink', id],
    queryFn: () => read(getShortLinkAction(id)),
    enabled: !!id,
    retry: (count: number, e: Error) => shouldRetryQuery(count, e),
    staleTime: 30 * 1000,
  });
}

export function useShortLinkStats(id: string, days: StatsPeriod) {
  return useQuery({
    queryKey: ['shortLinkStats', id, days],
    queryFn: () => read(getShortLinkStatsAction(id, days)),
    enabled: !!id,
    retry: (count: number, e: Error) => shouldRetryQuery(count, e),
    staleTime: 60 * 1000,
  });
}

export function useShortLinksOverview(days: StatsPeriod) {
  return useQuery({
    queryKey: ['shortLinksOverview', days],
    queryFn: () => read(getShortLinksOverviewAction(days)),
    retry: (count: number, e: Error) => shouldRetryQuery(count, e),
    staleTime: 60 * 1000,
  });
}

async function write<T>(promise: Promise<{ ok: true; data: T } | { ok: false; code?: string; error: string }>): Promise<T> {
  try {
    return await unwrapAction(promise);
  } catch (e) {
    if (e instanceof ActionError) throw e;
    console.error('[liens] écriture impossible', e);
    throw new Error('Enregistrement impossible : session expirée ? Reconnectez-vous puis recommencez.');
  }
}

function useInvalidateLinks() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shortLinks'] }),
      queryClient.invalidateQueries({ queryKey: ['shortLink'] }),
    ]);
}

export function useCreateShortLink() {
  const toast = useToast();
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: (values: ShortLinkFormValues) => write(createShortLinkAction(values)),
    onSuccess: () => toast('Lien créé'),
    onSettled: invalidate,
  });
}

export function useUpdateShortLink() {
  const toast = useToast();
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({ id, values, expectedUpdatedAt }: { id: string; values: ShortLinkFormValues; expectedUpdatedAt: string }) =>
      write(updateShortLinkAction(id, values, expectedUpdatedAt)),
    onSuccess: () => toast('Lien enregistré'),
    onSettled: invalidate,
  });
}

export function useSetShortLinkActive() {
  const toast = useToast();
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({ id, active, expectedUpdatedAt }: { id: string; active: boolean; expectedUpdatedAt: string }) =>
      write(setShortLinkActiveAction(id, active, expectedUpdatedAt)),
    onSuccess: (link) => toast(link.active ? 'Lien réactivé' : 'Lien désactivé'),
    onError: (e) => toast(e instanceof Error ? e.message : 'Enregistrement impossible', 'error'),
    onSettled: invalidate,
  });
}

export function useUpdateShortLinkSettings() {
  const toast = useToast();
  const invalidate = useInvalidateLinks();
  return useMutation({
    mutationFn: ({ values, expectedUpdatedAt }: {
      values: { appStoreUrl: string | null; playStoreUrl: string | null; appStoreProviderToken: string | null };
      expectedUpdatedAt: string;
    }) => write(updateShortLinkSettingsAction(values, expectedUpdatedAt)),
    onSuccess: () => toast('Liens des stores enregistrés'),
    onSettled: invalidate,
  });
}

/** Télécharge le CSV des agrégats (préparé par l'action serveur) depuis le navigateur. */
export async function downloadShortLinkStatsCsv(linkId: string | null, days: StatsPeriod): Promise<boolean> {
  const data = await write(exportShortLinkStatsCsvAction({ linkId, days }));
  // BOM : accents lisibles dans Excel.
  downloadBlob(new Blob([String.fromCharCode(0xfeff), data.csv], { type: 'text/csv;charset=utf-8' }), data.filename);
  return data.truncated;
}
