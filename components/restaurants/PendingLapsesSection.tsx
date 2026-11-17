'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePendingLapseDetail, useRestaurantAlerts } from '@/lib/hooks/useRestaurantAlerts';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { AlertKindPill } from '@/components/alerts/RestaurantAlertDot';
import {
  alertDetail,
  CLOSURES_PAGE_SIZE,
  formatDay,
  formatInstant,
  formatRate,
  rateAxisMax,
  RESERVATION_TYPE_LABELS,
  SEVERITY_LABELS,
  SOURCE_LABELS,
} from '@/lib/utils/restaurantAlerts';
import type { AlertSeverity, PendingLapseDetail, PendingLapseWeek } from '@/lib/types/restaurantAlerts';

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
      <AlertTriangle size={15} className="shrink-0" />
      {message}
    </div>
  );
}

/** Encadré « Alertes » de la fiche : tous les types en cours pour ce restaurant. */
export function RestaurantAlertsBox({ restaurantId }: { restaurantId: string }) {
  const { data, error, isPending } = useRestaurantAlerts(restaurantId);
  if (isPending) return null;
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionTitle title="Alertes" />
        <div className="p-5"><ErrorBox message={actionErrorMessage(error, 'Impossible de charger les alertes.')} /></div>
      </div>
    );
  }
  const alerts = data?.alerts ?? [];
  if (alerts.length === 0) return null;
  return (
    <section aria-label="Alertes" className="bg-white rounded-xl border border-red-200 overflow-hidden">
      <SectionTitle title="Alertes" />
      <ul className="divide-y divide-gray-50">
        {alerts.map((alert) => {
          const detail = alertDetail(alert);
          return (
            <li key={alert.kind} className="px-5 py-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <AlertKindPill alert={alert} />
                {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{SEVERITY_LABELS[alert.severity as AlertSeverity] ?? alert.severity}</p>
                {alert.since && <p>depuis le {formatInstant(alert.since, false)}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Tile({ label, value, sub, tone = 'gray' }: { label: string; value: string; sub?: string; tone?: 'gray' | 'red' }) {
  return (
    <div className={`rounded-xl p-3.5 border ${tone === 'red' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });

const BAR_COLOR = '#FF6B35';
const RATE_COLOR = '#1e3a8a';

/**
 * Évolution sur 12 semaines : barres = nombre de demandes non confirmées (axe de gauche),
 * ligne = taux (axe de droite), seuil de taux en pointillés.
 */
function TrendChart({ weeks, minRate }: { weeks: PendingLapseWeek[]; minRate?: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  if (weeks.length === 0) return null;
  const W = 600;
  const H = 160;
  const top = 14;
  const bottom = 22;
  const left = 30;
  const right = 40;
  const plot = H - top - bottom;
  const col = (W - left - right) / weeks.length;
  const barW = Math.min(28, col - 8);
  const max = Math.max(1, ...weeks.map((w) => w.lapsed));
  const rateMax = rateAxisMax(weeks, minRate);
  const base = top + plot;
  const y = (v: number) => base - (v / max) * plot;
  const yRate = (r: number) => base - (Math.min(r, rateMax) / rateMax) * plot;
  const cx = (i: number) => left + col * i + col / 2;
  const tip = (w: PendingLapseWeek) =>
    w.tracked
      ? `Semaine du ${shortDay(w.period_start)} au ${shortDay(w.period_end)} : ${w.lapsed} non confirmée(s) sur ${w.total} (${formatRate(w.rate)})`
      : `Semaine du ${shortDay(w.period_start)} au ${shortDay(w.period_end)} : avant le début du suivi`;

  // Ligne du taux : un tronçon par suite de semaines suivies avec un taux (sans relier un trou).
  const segments: { i: number; r: number }[][] = [];
  weeks.forEach((w, i) => {
    if (!w.tracked || w.rate === null) {
      if (segments.length && segments[segments.length - 1].length) segments.push([]);
      return;
    }
    if (!segments.length) segments.push([]);
    segments[segments.length - 1].push({ i, r: w.rate });
  });
  const points = segments.flat();

  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-semibold text-gray-500">Demandes non confirmées par semaine : nombre et taux (12 semaines)</figcaption>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_COLOR }} />
          Nombre (axe de gauche)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden width="18" height="10" viewBox="0 0 18 10">
            <line x1={0} x2={18} y1={5} y2={5} stroke={RATE_COLOR} strokeWidth={2} />
            <circle cx={9} cy={5} r={3} fill={RATE_COLOR} stroke="#fff" strokeWidth={1} />
          </svg>
          Taux (axe de droite)
        </span>
        {minRate != null && (
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden width="18" height="10" viewBox="0 0 18 10">
              <line x1={0} x2={18} y1={5} y2={5} stroke={RATE_COLOR} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            </svg>
            Seuil de taux ({formatRate(minRate)})
          </span>
        )}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Évolution des demandes non confirmées sur 12 semaines, en nombre et en taux (détail dans le tableau ci-dessous)">
          <line x1={left} x2={W - right} y1={base} y2={base} stroke="#e5e7eb" strokeWidth={1} />
          <line x1={left} x2={W - right} y1={top} y2={top} stroke="#f3f4f6" strokeWidth={1} />
          <text x={left - 6} y={top + 3} fontSize={10} textAnchor="end" fill={BAR_COLOR}>{max}</text>
          <text x={left - 6} y={base + 3} fontSize={10} textAnchor="end" fill="#9ca3af">0</text>
          <text x={W - right + 6} y={top + 3} fontSize={10} fill={RATE_COLOR}>{formatRate(rateMax)}</text>
          <text x={W - right + 6} y={base + 3} fontSize={10} fill="#9ca3af">0 %</text>
          {weeks.map((w, i) => {
            const h = Math.max(w.lapsed > 0 ? 2 : 0, base - y(w.lapsed));
            return (
              <g key={w.period_start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* Zone de survol plus large que la barre */}
                <rect x={left + col * i} y={0} width={col} height={H} fill={hover === i ? '#f9fafb' : 'transparent'}>
                  <title>{tip(w)}</title>
                </rect>
                {w.tracked ? (
                  <rect x={cx(i) - barW / 2} y={base - h} width={barW} height={h} rx={h > 4 ? 4 : 0} fill={BAR_COLOR} opacity={0.85} pointerEvents="none" />
                ) : (
                  <rect x={cx(i) - barW / 2} y={base - 6} width={barW} height={6} fill="#e5e7eb" pointerEvents="none" />
                )}
                <text x={cx(i)} y={H - 6} fontSize={10} textAnchor="middle" fill={w.tracked ? '#6b7280' : '#d1d5db'} pointerEvents="none">
                  {shortDay(w.period_end)}
                </text>
              </g>
            );
          })}
          {minRate != null && minRate <= rateMax && (
            <line
              x1={left} x2={W - right} y1={yRate(minRate)} y2={yRate(minRate)}
              stroke={RATE_COLOR} strokeWidth={1} strokeDasharray="4 4" opacity={0.6} pointerEvents="none"
              data-testid="rate-threshold"
            />
          )}
          {segments.filter((seg) => seg.length > 1).map((seg) => (
            <polyline
              key={`seg-${seg[0].i}`}
              points={seg.map((p) => `${cx(p.i)},${yRate(p.r)}`).join(' ')}
              fill="none" stroke={RATE_COLOR} strokeWidth={2} strokeLinejoin="round" pointerEvents="none"
              data-testid="rate-line"
            />
          ))}
          {points.map((p) => (
            <circle
              key={`pt-${p.i}`} cx={cx(p.i)} cy={yRate(p.r)} r={hover === p.i ? 4.5 : 3.5}
              fill={RATE_COLOR} stroke="#fff" strokeWidth={1.5} pointerEvents="none"
              data-testid="rate-point"
            />
          ))}
        </svg>
        {hover !== null && (
          <p role="status" className="absolute top-0 right-0 max-w-xs text-xs bg-gray-900 text-white rounded-lg px-2.5 py-1.5 shadow">
            {tip(weeks[hover])}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-400">Barres grises : semaines antérieures au début du suivi (aucune donnée).</p>
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Voir le tableau</summary>
        <table className="w-full mt-2">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="font-medium py-1">Semaine</th>
              <th className="font-medium py-1 text-right">Reçues</th>
              <th className="font-medium py-1 text-right">Non confirmées</th>
              <th className="font-medium py-1 text-right">Taux</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.period_start} className={`border-t border-gray-50 ${w.tracked ? '' : 'text-gray-300'}`}>
                <td className="py-1">{shortDay(w.period_start)} – {shortDay(w.period_end)}{w.tracked ? '' : ' (non suivie)'}</td>
                <td className="py-1 text-right">{w.tracked ? w.total : '—'}</td>
                <td className="py-1 text-right">{w.tracked ? w.lapsed : '—'}</td>
                <td className="py-1 text-right">{w.tracked ? formatRate(w.rate) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Summary({ detail }: { detail: PendingLapseDetail }) {
  const { current, previous, settings } = detail;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          label="Non confirmées (30 jours)"
          value={String(current.lapsed)}
          sub={current.alert ? 'Au-dessus des seuils : en alerte' : undefined}
          tone={current.alert ? 'red' : 'gray'}
        />
        <Tile label="Demandes reçues (App et widget)" value={String(current.total)} sub="service passé, 30 jours" />
        <Tile label="Taux" value={formatRate(current.rate)} sub={`30 jours précédents : ${formatRate(previous.rate)} (${previous.lapsed} sur ${previous.total})`} />
      </div>
      <p className="text-xs text-gray-500">
        Alerte à partir de <strong>{settings.pending_lapse_min_count}</strong>{' '}demandes non confirmées et d&apos;un taux d&apos;au
        moins <strong>{formatRate(settings.pending_lapse_min_rate)}</strong> sur 30 jours. Suivi depuis le{' '}
        {formatInstant(settings.pending_lapse_tracking_since, false)}.
        {current.last_lapse_at && <> Dernière demande échue : service fini le {formatInstant(current.last_lapse_at)}.</>}
      </p>
    </div>
  );
}

function Closures({ detail, offset, onPage, fetching }: {
  detail: PendingLapseDetail;
  offset: number;
  onPage: (offset: number) => void;
  fetching: boolean;
}) {
  const { closures } = detail;
  if (closures.total === 0) {
    return <p className="text-sm text-gray-500">Aucune demande fermée sans réponse sur les {closures.days} derniers jours.</p>;
  }
  const end = Math.min(offset + closures.items.length, closures.total);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500">Fermetures sans réponse ({closures.days} derniers jours)</p>
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${fetching ? 'opacity-60' : ''}`}>
          <thead>
            <tr className="text-left text-xs text-gray-400">
              <th className="font-medium py-1 pr-4">Date</th>
              <th className="font-medium py-1 pr-4">Heure</th>
              <th className="font-medium py-1 pr-4 text-right">Couverts</th>
              <th className="font-medium py-1 pr-4">Source</th>
              <th className="font-medium py-1 pr-4">Type</th>
              <th className="font-medium py-1">Fermée le</th>
            </tr>
          </thead>
          <tbody>
            {closures.items.map((item, i) => (
              <tr key={`${offset + i}`} className="border-t border-gray-50">
                <td className="py-1.5 pr-4">{formatDay(item.booking_date)}</td>
                <td className="py-1.5 pr-4">{item.booking_time ?? '—'}</td>
                <td className="py-1.5 pr-4 text-right">{item.number_of_guests ?? '—'}</td>
                <td className="py-1.5 pr-4">{SOURCE_LABELS[item.booking_source ?? ''] ?? item.booking_source ?? '—'}</td>
                <td className="py-1.5 pr-4">{RESERVATION_TYPE_LABELS[item.reservation_type ?? ''] ?? item.reservation_type ?? '—'}</td>
                <td className="py-1.5 text-gray-500">{formatInstant(item.closed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {closures.total > CLOSURES_PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{offset + 1}–{end} sur {closures.total}</span>
          <div className="flex gap-1">
            <button
              onClick={() => onPage(Math.max(0, offset - CLOSURES_PAGE_SIZE))}
              disabled={offset === 0 || fetching}
              aria-label="Page précédente"
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => onPage(offset + CLOSURES_PAGE_SIZE)}
              disabled={end >= closures.total || fetching}
              aria-label="Page suivante"
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fiche d'un restaurant : bloc « Demandes non confirmées » (aucune donnée de client). */
export function PendingLapsesSection({ restaurantId }: { restaurantId: string }) {
  const [offset, setOffset] = useState(0);
  const { data, error, isPending, isFetching } = usePendingLapseDetail(restaurantId, offset);

  return (
    <section aria-label="Demandes non confirmées" className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <SectionTitle title="Demandes non confirmées" />
      <div className="p-5 space-y-5">
        {error ? (
          <ErrorBox message={actionErrorMessage(error, 'Impossible de charger les demandes non confirmées.')} />
        ) : isPending || !data ? (
          <div className="space-y-3 animate-pulse">
            <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
            <div className="h-36 bg-gray-50 rounded-xl" />
          </div>
        ) : (
          <>
            <Summary detail={data} />
            <TrendChart weeks={data.trend} minRate={data.settings.pending_lapse_min_rate} />
            <Closures detail={data} offset={offset} onPage={setOffset} fetching={isFetching} />
          </>
        )}
      </div>
    </section>
  );
}
