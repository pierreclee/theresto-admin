'use client';

// Demandes d'ouverture d'un espace restaurant (contrat : docs/features/onboarding-accompagne.md
// du dépôt de l'app). « Inviter » ouvre l'invitation existante, classique ou parcours
// accompagné, préremplie avec l'adresse du compte : admin-onboarding passe alors la demande
// en attente de ce compte à « invited ». « Refuser » la passe à « declined » après confirmation.

import { useState } from 'react';
import NextLink from 'next/link';
import { Handshake, Mail, UserPlus, XCircle } from 'lucide-react';
import { Badge } from '@/components/shared/Badge';
import { Modal } from '@/components/shared/Modal';
import { useToast } from '@/components/shared/Toaster';
import { InviteRestaurantModal } from '@/components/restaurants/InviteRestaurantModal';
import { AccompaniedOnboardingModal } from '@/components/restaurants/AccompaniedOnboardingModal';
import { useDeclineRestaurantAccessRequest, useRefreshAccessRequests } from '@/lib/hooks/useAccessRequests';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { formatInstant } from '@/lib/utils/restaurantAlerts';
import type { AccessRequest, AccessRequestStatus } from '@/lib/types/accessRequests';

export const ACCESS_REQUEST_STATUS: Record<AccessRequestStatus, { label: string; variant: 'warning' | 'success' | 'gray' }> = {
  pending: { label: 'En attente', variant: 'warning' },
  invited: { label: 'Invitée', variant: 'success' },
  declined: { label: 'Refusée', variant: 'gray' },
};

const MESSAGE_PREVIEW = 80;

/** Message tronqué pour la liste (texte complet au survol). */
export function truncateMessage(message: string | null, max = MESSAGE_PREVIEW): string {
  if (!message) return '—';
  const flat = message.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

type Dialog =
  | { kind: 'choose'; request: AccessRequest }
  | { kind: 'email'; request: AccessRequest }
  | { kind: 'accompanied'; request: AccessRequest }
  | { kind: 'decline'; request: AccessRequest };

export function AccessRequestsTable({ requests }: { requests: AccessRequest[] }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [declineError, setDeclineError] = useState('');
  const decline = useDeclineRestaurantAccessRequest();
  const refresh = useRefreshAccessRequests();
  const toast = useToast();

  const close = () => {
    setDialog(null);
    setDeclineError('');
  };

  const confirmDecline = async (request: AccessRequest) => {
    setDeclineError('');
    try {
      const result = await decline.mutateAsync(request.id);
      close();
      if (result.auditLogged) toast('Demande refusée');
      else toast("Demande refusée, mais elle n'a pas pu être journalisée. Prévenez l'équipe technique.", 'error');
    } catch (e) {
      setDeclineError(actionErrorMessage(e, 'Impossible de refuser la demande.'));
    }
  };

  if (requests.length === 0) return <p className="text-sm text-gray-500 py-6 text-center">Aucune demande.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400">
              <th className="font-medium py-2 pr-4">Date</th>
              <th className="font-medium py-2 pr-4">Restaurant</th>
              <th className="font-medium py-2 pr-4">Ville</th>
              <th className="font-medium py-2 pr-4">Téléphone</th>
              <th className="font-medium py-2 pr-4">E-mail</th>
              <th className="font-medium py-2 pr-4">Message</th>
              <th className="font-medium py-2 pr-4">Statut</th>
              <th className="font-medium py-2" />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const status = ACCESS_REQUEST_STATUS[r.status] ?? { label: r.status, variant: 'gray' as const };
              return (
                <tr key={r.id} className="border-t border-gray-50 align-top">
                  <td className="py-2.5 pr-4 whitespace-nowrap">{formatInstant(r.createdAt)}</td>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">
                    <NextLink href={`/users?user=${r.userId}`} className="hover:underline" title="Voir le compte">
                      {r.restaurantName}
                    </NextLink>
                  </td>
                  <td className="py-2.5 pr-4">{r.city}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    <a href={`tel:${r.phone}`} className="text-[#FF6B35] hover:underline">{r.phone}</a>
                  </td>
                  <td className="py-2.5 pr-4">
                    {r.email ? (
                      <a href={`mailto:${r.email}`} className="text-[#FF6B35] hover:underline break-all">{r.email}</a>
                    ) : (
                      <span className="text-gray-400" title="Le compte n’existe plus">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 max-w-xs" title={r.message ?? undefined}>
                    {truncateMessage(r.message)}
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    <Badge label={status.label} variant={status.variant} size="sm" />
                    {r.handledAt && (
                      <p className="text-[11px] text-gray-400 mt-1">{formatInstant(r.handledAt, false)}</p>
                    )}
                  </td>
                  <td className="py-2.5 whitespace-nowrap text-right">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setDialog({ kind: 'choose', request: r })}
                          disabled={!r.email}
                          title={r.email ? undefined : 'Compte supprimé : aucune adresse à inviter'}
                          aria-label={`Inviter ${r.restaurantName}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#FF6B35] hover:bg-[#e85f2d] rounded-lg transition-colors disabled:opacity-40"
                        >
                          <UserPlus size={13} />
                          Inviter
                        </button>
                        <button
                          onClick={() => setDialog({ kind: 'decline', request: r })}
                          aria-label={`Refuser ${r.restaurantName}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
                        >
                          <XCircle size={13} />
                          Refuser
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog?.kind === 'choose' && (
        <Modal isOpen onClose={close} title={`Inviter ${dialog.request.restaurantName}`} size="sm">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              Invitation pour l’adresse {dialog.request.email}. La demande passera à « Invitée ».
            </p>
            <button
              onClick={() => setDialog({ kind: 'email', request: dialog.request })}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85f2d] rounded-xl transition-colors"
            >
              <Mail size={15} />
              Invitation par e-mail (7 jours)
            </button>
            <button
              onClick={() => setDialog({ kind: 'accompanied', request: dialog.request })}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#FF6B35] bg-white hover:bg-orange-50 border border-[#FF6B35]/40 rounded-xl transition-colors"
            >
              <Handshake size={15} />
              Parcours accompagné (2 heures, lien et QR code)
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'email' && dialog.request.email && (
        <InviteRestaurantModal onClose={close} initialEmail={dialog.request.email} onInvited={refresh} />
      )}
      {dialog?.kind === 'accompanied' && dialog.request.email && (
        <AccompaniedOnboardingModal onClose={close} initialEmail={dialog.request.email} onInvited={refresh} />
      )}

      {dialog?.kind === 'decline' && (
        <Modal
          isOpen
          onClose={close}
          title="Refuser la demande ?"
          size="sm"
          footer={
            <>
              <button
                onClick={close}
                disabled={decline.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={() => confirmDecline(dialog.request)}
                disabled={decline.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
              >
                {decline.isPending ? 'Refus…' : 'Refuser la demande'}
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            La demande de « {dialog.request.restaurantName} » ({dialog.request.city}) passera à « Refusée ». Aucun e-mail
            n’est envoyé : recontactez la personne si besoin. Elle pourra faire une nouvelle demande depuis son compte.
          </p>
          {declineError && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">
              {declineError}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
