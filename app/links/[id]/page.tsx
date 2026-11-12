'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Pencil } from 'lucide-react';
import { useSetShortLinkActive, useShortLink } from '@/lib/hooks/useShortLinks';
import { ShortLinkFormModal } from '@/components/links/ShortLinkFormModal';
import { QrGenerator } from '@/components/links/QrGenerator';
import { LinkStatsPanel } from '@/components/links/LinkStatsPanels';
import { Loading } from '@/components/shared/Loading';
import { actionErrorMessage } from '@/lib/api/actionResult';

export default function ShortLinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error } = useShortLink(id);
  const setActive = useSetShortLinkActive();
  const [editing, setEditing] = useState(false);

  if (isPending) return <Loading />;
  if (error || !data) {
    return (
      <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
        {actionErrorMessage(error, 'Impossible de charger ce lien')}
      </div>
    );
  }
  const { link, domain } = data;
  const targets: [string, string | null][] = [
    ['Par défaut', link.targetDefault],
    ['iPhone', link.targetIos ?? (link.kind === 'download' ? 'App Store (réglages), sinon par défaut' : null)],
    ['Android', link.targetAndroid ?? (link.kind === 'download' ? 'Google Play (réglages), sinon par défaut' : null)],
  ];

  return (
    <div className="space-y-5">
      <button onClick={() => router.push('/links')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
        <ChevronLeft size={15} />
        Retour aux liens
      </button>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-mono">{domain}/{link.slug}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{link.label ?? 'Sans libellé'} · {link.active ? 'actif' : 'inactif'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActive.mutate({ id: link.id, active: !link.active, expectedUpdatedAt: link.updatedAt })}
              disabled={setActive.isPending}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {link.active ? 'Désactiver' : 'Réactiver'}
            </button>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50">
              <Pencil size={12} />
              Modifier
            </button>
          </div>
        </div>
        <dl className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {targets.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-gray-400">Cible {label}</dt>
              <dd className="text-gray-800 break-all">{value ?? 'cible par défaut'}</dd>
            </div>
          ))}
          {([
            ['Type', link.kind === 'download' ? 'Téléchargement' : 'Web'],
            ['Paramètres transmis', link.forwardParams === 'utm' ? 'utm_* et src' : 'aucun'],
            ['Persona', link.persona ?? '—'],
            ['Ville', link.ville ?? '—'],
            ['Campagne', link.campaign ?? '—'],
            ['Source', link.src ?? '—'],
            ["Accepte src/ville/persona de l'adresse", link.acceptsQueryAttributes ? 'oui (ancien lien /telecharger?src=…)' : 'non'],
            ['Expiration', link.expiresAt ? new Date(link.expiresAt).toLocaleString('fr-FR') : 'aucune'],
          ] as const).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-gray-400">{label}</dt>
              <dd className="text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="px-5 pb-4 text-xs text-gray-400">Une modification se voit sous une minute (cache du Worker).</p>
      </div>

      <QrGenerator
        domain={domain}
        slug={link.slug}
        defaultTitle={link.kind === 'download' ? "Téléchargez l'app TheResto" : 'TheResto'}
      />
      <LinkStatsPanel linkId={link.id} />

      {editing && <ShortLinkFormModal link={link} domain={domain} onClose={() => setEditing(false)} />}
    </div>
  );
}
