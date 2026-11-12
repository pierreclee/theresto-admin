'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { useSetShortLinkActive, useShortLinks } from '@/lib/hooks/useShortLinks';
import { ShortLinkFormModal } from '@/components/links/ShortLinkFormModal';
import { ShortLinkSettingsCard } from '@/components/links/ShortLinkSettingsCard';
import { LinksOverviewPanel } from '@/components/links/LinkStatsPanels';
import type { ShortLink } from '@/lib/types/shortLinks';

const nf = new Intl.NumberFormat('fr-FR');

function isExpired(link: ShortLink): boolean {
  return link.expiresAt !== null && new Date(link.expiresAt).getTime() <= Date.now();
}

function StatusBadge({ link }: { link: ShortLink }) {
  const [label, cls] = !link.active
    ? ['Inactif', 'bg-gray-100 text-gray-600']
    : isExpired(link)
      ? ['Expiré', 'bg-amber-50 text-amber-700']
      : ['Actif', 'bg-green-50 text-green-700'];
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{label}</span>;
}

export default function LinksPage() {
  const { data, isPending, error } = useShortLinks();
  const setActive = useSetShortLinkActive();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Liens &amp; QR</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Liens courts {data ? <span className="font-mono">{data.domain}</span> : null} : redirection selon le téléphone et comptage des scans.
            Un lien imprimé ne se supprime pas : il se désactive.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          disabled={!data}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-lg disabled:opacity-40 flex-shrink-0"
        >
          <Plus size={15} />
          Nouveau lien
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} />
          {error.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-50">
              {['Slug', 'Libellé', 'Type', 'Persona', 'Ville', 'Campagne', 'État', 'Scans 30 j', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Chargement…</td></tr>
            ) : data && data.links.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Aucun lien.</td></tr>
            ) : (
              data?.links.map((link) => (
                <tr key={link.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/links/${link.id}`} className="text-[#FF6B35] hover:underline">/{link.slug}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[14rem] truncate" title={link.label ?? undefined}>{link.label ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{link.kind === 'download' ? 'Téléchargement' : 'Web'}</td>
                  <td className="px-4 py-3 text-gray-600">{link.persona ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{link.ville ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{link.campaign ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge link={link} /></td>
                  <td className="px-4 py-3 tabular-nums text-gray-900">{nf.format(link.scans30d)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setActive.mutate({ id: link.id, active: !link.active, expectedUpdatedAt: link.updatedAt })}
                      disabled={setActive.isPending}
                      className="text-xs font-medium text-gray-500 hover:text-[#FF6B35] disabled:opacity-50"
                    >
                      {link.active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && (data.unknownScans30d > 0 || data.truncated) && (
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-50">
            {data.unknownScans30d > 0 && <>{nf.format(data.unknownScans30d)} scan(s) vers un lien inconnu sur 30 jours. </>}
            {data.truncated && <>Compteurs partiels : trop de lignes.</>}
          </p>
        )}
      </div>

      {data && <ShortLinkSettingsCard settings={data.settings} />}
      <LinksOverviewPanel />

      {creating && data && <ShortLinkFormModal link={null} domain={data.domain} onClose={() => setCreating(false)} />}
    </div>
  );
}
