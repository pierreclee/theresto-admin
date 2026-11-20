'use client';

import { Suspense, useState } from 'react';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { OntimeReportDialog, OntimeStatusPill } from '@/components/ontime/OntimeReportDialog';
import { useOntimePendingCount, useOntimeReports } from '@/lib/hooks/useOntime';
import { useAuth } from '@/lib/hooks/useAuth';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { formatInstant } from '@/lib/utils/restaurantAlerts';
import { delayCategoryLabel, formatRemaining, lastPageOffset, ONTIME_FILTERS, ONTIME_PAGE_SIZE } from '@/lib/utils/ontime';
import type { OntimeReport, OntimeReportFilter } from '@/lib/types/ontime';

/** Colonne « Contestation / échéance » selon le statut. */
function contestCell(report: OntimeReport): string {
  if (report.status === 'open') {
    return report.contest_paused ? 'Délai gelé (restaurant suspendu)' : `Reste ${formatRemaining(report.contest_remaining_seconds)}`;
  }
  if (report.contested_at) return `Contesté le ${formatInstant(report.contested_at)}`;
  return '—';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `?restaurant=<id>` (lien de la fiche d'un restaurant) : signalements de ce restaurant seul. */
export default function OntimePage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>}>
      <OntimeReports />
    </Suspense>
  );
}

function OntimeReports() {
  const param = useSearchParams().get('restaurant');
  const restaurantId = param && UUID.test(param) ? param.toLowerCase() : null;
  return <OntimeReportsList key={restaurantId ?? 'all'} restaurantId={restaurantId} />;
}

function OntimeReportsList({ restaurantId }: { restaurantId: string | null }) {
  // Un restaurant : tous ses signalements d'abord ; sinon les contestations à trancher.
  const [filter, setFilter] = useState<OntimeReportFilter>(restaurantId ? 'all' : 'contested');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<OntimeReport | null>(null);
  const { isAdmin, sessionValid } = useAuth();
  const pendingCount = useOntimePendingCount(isAdmin && sessionValid);
  const { data, isPending, error, isFetching, isPlaceholderData } = useOntimeReports(filter, offset, restaurantId);
  const total = data?.total ?? 0;

  // Page devenue vide (décision sur le dernier signalement de la dernière page, liste raccourcie
  // ailleurs) : retour à la dernière page qui existe (mise à jour pendant le rendu, sans effet).
  const lastOffset = data && !isPlaceholderData ? lastPageOffset(data.total, offset) : offset;
  if (lastOffset !== offset) setOffset(lastOffset);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">OnTime</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Signalements « servi en retard » des précommandes OnTime (CGV 7.4 bis) : TheResto tranche les contestations
          des restaurants. Données de la réservation seulement, jamais l&apos;identité du client.
        </p>
        {restaurantId && (
          <p className="text-sm text-gray-700 mt-2" data-testid="ontime-restaurant-filter">
            Signalements de{' '}
            <NextLink href={`/restaurants/${restaurantId}`} className="text-[#FF6B35] hover:underline">
              {data?.reports[0]?.restaurant_name || 'ce restaurant'}
            </NextLink>
            {' · '}
            <NextLink href="/ontime" className="text-gray-500 hover:underline">Tous les restaurants</NextLink>
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtrer les signalements">
          {ONTIME_FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => { setFilter(f.value); setOffset(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                filter === f.value ? 'bg-[#FF6B35] text-white' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {f.label}
              {f.value === 'contested' && !restaurantId && pendingCount > 0 && (
                <span
                  aria-label={`${pendingCount} à trancher`}
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full"
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {error ? (
            <p role="alert" className="text-sm text-red-600 py-8 text-center flex items-center justify-center gap-2">
              <AlertTriangle size={15} />
              {actionErrorMessage(error, 'Impossible de charger les signalements.')}
            </p>
          ) : isPending ? (
            <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>
          ) : data.reports.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">Aucun signalement.</p>
          ) : (
            <div className={`overflow-x-auto ${isFetching ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400">
                    <th className="font-medium py-2 pr-4">Heure convenue</th>
                    <th className="font-medium py-2 pr-4">Restaurant</th>
                    <th className="font-medium py-2 pr-4">Retard déclaré</th>
                    <th className="font-medium py-2 pr-4">Statut</th>
                    <th className="font-medium py-2 pr-4">Contestation</th>
                    <th className="font-medium py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.reports.map((report) => (
                    <tr key={report.id} className="border-t border-gray-50 align-top">
                      <td className="py-2.5 pr-4 whitespace-nowrap">{formatInstant(report.slot_at)}</td>
                      <td className="py-2.5 pr-4">
                        <NextLink href={`/restaurants/${report.restaurant_id}`} className="text-[#FF6B35] hover:underline">
                          {report.restaurant_name || 'Restaurant sans nom'}
                        </NextLink>
                      </td>
                      <td className="py-2.5 pr-4">{delayCategoryLabel(report.delay_category)}</td>
                      <td className="py-2.5 pr-4"><OntimeStatusPill status={report.status} /></td>
                      <td className="py-2.5 pr-4 text-gray-600">{contestCell(report)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setSelected(report)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50"
                        >
                          {report.status === 'contested' ? 'Trancher' : 'Voir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {total > ONTIME_PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span>
              {offset + 1}–{Math.min(offset + ONTIME_PAGE_SIZE, total)} sur {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={offset === 0 || isPlaceholderData}
                onClick={() => setOffset(Math.max(0, offset - ONTIME_PAGE_SIZE))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                disabled={offset + ONTIME_PAGE_SIZE >= total || isPlaceholderData}
                onClick={() => setOffset(offset + ONTIME_PAGE_SIZE)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && <OntimeReportDialog report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
