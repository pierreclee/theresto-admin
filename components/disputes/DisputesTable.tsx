'use client';

import NextLink from 'next/link';
import { ExternalLink } from 'lucide-react';
import { formatDay, formatInstant } from '@/lib/utils/restaurantAlerts';
import {
  disputeKindLabel,
  disputeReasonLabel,
  disputeStatusClasses,
  disputeStatusLabel,
  formatCents,
  stripeDashboardUrl,
} from '@/lib/utils/disputes';
import type { DisputeRow } from '@/lib/types/disputes';

/** Lien vers un objet du tableau de bord Stripe (nouvel onglet), ou « — ». */
export function StripeLink({ id, livemode, label }: { id: string | null; livemode: boolean; label?: string }) {
  const url = stripeDashboardUrl(id, livemode);
  if (!url) return <span className="text-gray-400">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-[#FF6B35] hover:underline"
      title={id ?? undefined}
    >
      {label ?? 'Stripe'}
      <ExternalLink size={11} />
    </a>
  );
}

/** Litiges : statut, montants, échéance de réponse, lien Stripe par id. Aucune donnée du client. */
export function DisputesTable({ disputes, showRestaurant = true }: { disputes: DisputeRow[]; showRestaurant?: boolean }) {
  if (disputes.length === 0) return <p className="text-sm text-gray-500">Aucun litige.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400">
            <th className="font-medium py-2 pr-4">Ouvert le</th>
            {showRestaurant && <th className="font-medium py-2 pr-4">Restaurant</th>}
            <th className="font-medium py-2 pr-4">Paiement</th>
            <th className="font-medium py-2 pr-4 text-right">Montant</th>
            <th className="font-medium py-2 pr-4 text-right">Frais</th>
            <th className="font-medium py-2 pr-4">Motif</th>
            <th className="font-medium py-2 pr-4">Statut</th>
            <th className="font-medium py-2 pr-4">Réponse avant</th>
            <th className="font-medium py-2" />
          </tr>
        </thead>
        <tbody>
          {disputes.map((d) => (
            <tr key={d.stripeDisputeId} className="border-t border-gray-50 align-top">
              <td className="py-2.5 pr-4 whitespace-nowrap">{formatInstant(d.openedAt, false)}</td>
              {showRestaurant && (
                <td className="py-2.5 pr-4">
                  {d.restaurantId ? (
                    <NextLink href={`/restaurants/${d.restaurantId}`} className="text-[#FF6B35] hover:underline">
                      {d.restaurantName || 'Restaurant sans nom'}
                    </NextLink>
                  ) : (
                    <span className="text-gray-500">Restaurant non retrouvé</span>
                  )}
                </td>
              )}
              <td className="py-2.5 pr-4">
                {disputeKindLabel(d.kind)}
                {d.bookingDate && <span className="block text-xs text-gray-400">Réservation du {formatDay(d.bookingDate)}</span>}
              </td>
              <td className="py-2.5 pr-4 text-right whitespace-nowrap">{formatCents(d.amountCents, d.currency)}</td>
              <td className="py-2.5 pr-4 text-right whitespace-nowrap">{d.feeCents === null ? '—' : formatCents(d.feeCents, d.currency)}</td>
              <td className="py-2.5 pr-4">{disputeReasonLabel(d.reason)}</td>
              <td className="py-2.5 pr-4">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${disputeStatusClasses(d.status)}`}>
                  {disputeStatusLabel(d.status)}
                </span>
                {d.closedAt && <span className="block text-xs text-gray-400 mt-0.5">clos le {formatInstant(d.closedAt, false)}</span>}
              </td>
              <td className="py-2.5 pr-4 whitespace-nowrap">{d.evidenceDueBy ? formatInstant(d.evidenceDueBy) : '—'}</td>
              <td className="py-2.5 text-right">
                <StripeLink id={d.stripeDisputeId} livemode={d.livemode} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
