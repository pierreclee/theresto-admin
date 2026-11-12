'use client';

import { useState } from 'react';
import { AlertTriangle, Download, Info } from 'lucide-react';
import { useShortLinksOverview, useShortLinkStats, downloadShortLinkStatsCsv } from '@/lib/hooks/useShortLinks';
import { NONE_KEY, PLATFORM_LABELS, STATS_PERIODS, type CountEntry, type StatsPeriod } from '@/lib/links/linkStats';
import { useToast } from '@/components/shared/Toaster';

export const SCANS_NOT_INSTALLS =
  'Scans, pas installations : les installations se lisent dans App Store Connect et la Play Console.';

const nf = new Intl.NumberFormat('fr-FR');
const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

function PeriodTabs({ value, onChange }: { value: StatsPeriod; onChange: (p: StatsPeriod) => void }) {
  return (
    <div role="tablist" aria-label="Période" className="flex gap-1">
      {STATS_PERIODS.map((p) => (
        <button
          key={p}
          role="tab"
          aria-selected={value === p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${value === p ? 'bg-[#FF6B35] text-white' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'}`}
        >
          {p} jours
        </button>
      ))}
    </div>
  );
}

function CsvButton({ linkId, days }: { linkId: string | null; days: StatsPeriod }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const truncated = await downloadShortLinkStatsCsv(linkId, days);
          if (truncated) toast('Export partiel : trop de lignes, réduisez la période.', 'error');
        } catch (e) {
          toast(e instanceof Error ? e.message : "L'export a échoué.", 'error');
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 disabled:opacity-50"
    >
      <Download size={12} />
      {busy ? 'Export…' : 'Export CSV'}
    </button>
  );
}

function Reminder() {
  return (
    <p className="flex gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
      <Info size={14} className="shrink-0 mt-0.5 text-gray-400" />
      {SCANS_NOT_INSTALLS}
    </p>
  );
}

function Shares({ title, entries, total, labelOf }: { title: string; entries: CountEntry[]; total: number; labelOf?: (k: string) => string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 mb-2">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun scan.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.slice(0, 12).map((e) => (
            <li key={e.key} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-gray-700 truncate">{labelOf ? labelOf(e.key) : e.key}</span>
                <span className="text-gray-500 tabular-nums">{nf.format(e.hits)} · {pct.format(total ? e.hits / total : 0)}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-[#FF6B35]" style={{ width: `${total ? (e.hits / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DailyBars({ byDay }: { byDay: { day: string; hits: number; botHits: number }[] }) {
  const max = Math.max(1, ...byDay.map((d) => d.hits));
  return (
    <div>
      <div className="flex items-end gap-px h-32" role="img" aria-label="Scans par jour">
        {byDay.map((d) => (
          <div
            key={d.day}
            title={`${new Date(`${d.day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${nf.format(d.hits)} scan(s), ${nf.format(d.botHits)} robot(s)`}
            className="flex-1 bg-[#FF6B35]/80 hover:bg-[#FF6B35] rounded-t-sm min-h-px"
            style={{ height: `${(d.hits / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{byDay[0]?.day}</span>
        <span>{byDay[byDay.length - 1]?.day}</span>
      </div>
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

/** Statistiques d'un lien : scans par jour, plateformes, pays, part de robots exclus. */
export function LinkStatsPanel({ linkId }: { linkId: string }) {
  const [days, setDays] = useState<StatsPeriod>(30);
  const { data, isPending, error } = useShortLinkStats(linkId, days);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Statistiques</h3>
        <div className="flex items-center gap-2">
          <PeriodTabs value={days} onChange={setDays} />
          <CsvButton linkId={linkId} days={days} />
        </div>
      </div>
      <div className="p-5 space-y-5">
        <Reminder />
        {error ? (
          <ErrorBox message={error.message} />
        ) : isPending || !data ? (
          <div className="h-40 bg-gray-50 rounded-xl animate-pulse" />
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ['Scans', nf.format(data.stats.totalHits)],
                ['Robots et aperçus exclus', nf.format(data.stats.totalBotHits)],
                ['Part de robots', pct.format(data.stats.botShare)],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="text-lg font-semibold text-gray-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <DailyBars byDay={data.stats.byDay} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Shares
                title="Plateformes"
                entries={data.stats.byPlatform.map((p) => ({ key: p.platform, hits: p.hits })).filter((e) => e.hits > 0)}
                total={data.stats.totalHits}
                labelOf={(k) => PLATFORM_LABELS[k as keyof typeof PLATFORM_LABELS] ?? k}
              />
              <Shares title="Pays" entries={data.stats.byCountry} total={data.stats.totalHits} labelOf={(k) => (k === '--' ? 'Inconnu' : k)} />
            </div>
            {data.truncated && <p className="text-xs text-amber-700">Lecture partielle : trop de lignes sur la période.</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** Vue d'ensemble de tous les liens, groupée par persona, ville et campagne. */
export function LinksOverviewPanel() {
  const [days, setDays] = useState<StatsPeriod>(30);
  const { data, isPending, error } = useShortLinksOverview(days);
  const none = (k: string) => (k === NONE_KEY ? 'Aucune' : k);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Vue d&apos;ensemble</h3>
          <p className="text-xs text-gray-400 mt-0.5">Tous les liens, robots et aperçus exclus.</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodTabs value={days} onChange={setDays} />
          <CsvButton linkId={null} days={days} />
        </div>
      </div>
      <div className="p-5 space-y-5">
        <Reminder />
        {error ? (
          <ErrorBox message={error.message} />
        ) : isPending || !data ? (
          <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
        ) : (
          <>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{nf.format(data.overview.totalHits)}</span> scans sur {days} jours
              {data.overview.unknownHits > 0 && <>, dont {nf.format(data.overview.unknownHits)} vers un lien inconnu</>}
              {' '}· {nf.format(data.overview.totalBotHits)} robots exclus
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Shares title="Persona" entries={data.overview.byPersona} total={data.overview.totalHits - data.overview.unknownHits} labelOf={none} />
              <Shares title="Ville" entries={data.overview.byVille} total={data.overview.totalHits - data.overview.unknownHits} labelOf={none} />
              <Shares title="Campagne" entries={data.overview.byCampaign} total={data.overview.totalHits - data.overview.unknownHits} labelOf={none} />
            </div>
            {data.truncated && <p className="text-xs text-amber-700">Lecture partielle : trop de lignes sur la période.</p>}
          </>
        )}
      </div>
    </div>
  );
}
