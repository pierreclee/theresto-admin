'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useUpdateShortLinkSettings } from '@/lib/hooks/useShortLinks';
import { validateShortLinkSettingsInput } from '@/lib/links/shortLinkRules';
import type { ShortLinkSettings } from '@/lib/types/shortLinks';

/** Conditions de mise en service, hors de l'admin (docs/features/short-links.md, §6). */
export const GO_LIVE_NOTE =
  'Mise en service : secret LINK_HIT_SECRET (32 caractères au moins, même valeur dans le Worker et le '
  + "projet Supabase, sinon aucun scan n'est compté) et règle de limite de débit Cloudflare sur le "
  + 'domaine des liens, obligatoire avant la prod.';

const inputClass =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20';

/** Liens des stores utilisés par les liens « download » sans cible iPhone ou Android propre. */
export function ShortLinkSettingsCard({ settings }: { settings: ShortLinkSettings | null }) {
  const { mutateAsync, isPending } = useUpdateShortLinkSettings();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ appStoreUrl: '', playStoreUrl: '', appStoreProviderToken: '' });
  const [error, setError] = useState('');

  if (!settings) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 text-sm text-gray-500">
        Réglages des stores introuvables (migration des liens courts pas encore appliquée ?).
      </div>
    );
  }

  const start = () => {
    setDraft({
      appStoreUrl: settings.appStoreUrl ?? '',
      playStoreUrl: settings.playStoreUrl ?? '',
      appStoreProviderToken: settings.appStoreProviderToken ?? '',
    });
    setError('');
    setEditing(true);
  };

  const save = async () => {
    const values = {
      appStoreUrl: draft.appStoreUrl.trim() || null,
      playStoreUrl: draft.playStoreUrl.trim() || null,
      appStoreProviderToken: draft.appStoreProviderToken.trim() || null,
    };
    const check = validateShortLinkSettingsInput(values);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    try {
      await mutateAsync({ values, expectedUpdatedAt: settings.updatedAt });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    }
  };

  const rows: [string, string | null][] = [
    ['App Store', settings.appStoreUrl],
    ['Google Play', settings.playStoreUrl],
    ['Provider token App Store (pt)', settings.appStoreProviderToken],
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Liens des stores</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Pour les liens « téléchargement » sans cible propre. Vides tant que les fiches ne sont pas publiées : l&apos;App en attendant.
          </p>
          <p className="text-xs text-gray-400 mt-1">{GO_LIVE_NOTE}</p>
        </div>
        {!editing && (
          <button onClick={start} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 flex-shrink-0">
            <Pencil size={12} />
            Modifier
          </button>
        )}
      </div>
      {editing ? (
        <div className="p-5 space-y-3">
          {([
            ['appStoreUrl', "App Store (fiche de l'app)", 'https://apps.apple.com/fr/app/theresto/id123456789'],
            ['playStoreUrl', 'Google Play', 'https://play.google.com/store/apps/details?id=com.theresto.application'],
            ['appStoreProviderToken', 'Provider token App Store (facultatif, chiffres)', ''],
          ] as const).map(([key, label, placeholder]) => (
            <div key={key}>
              <label htmlFor={`settings-${key}`} className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
              <input
                id={`settings-${key}`}
                className={inputClass}
                value={draft[key]}
                placeholder={placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            </div>
          ))}
          {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} disabled={isPending} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl disabled:opacity-50">Annuler</button>
            <button onClick={save} disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl disabled:opacity-40">
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ) : (
        <dl className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100 min-w-0">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5 truncate" title={value ?? undefined}>{value ?? 'non réglé'}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
