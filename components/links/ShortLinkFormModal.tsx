'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useCreateShortLink, useUpdateShortLink } from '@/lib/hooks/useShortLinks';
import { validateShortLinkInput } from '@/lib/links/shortLinkRules';
import type { ShortLink, ShortLinkFormValues } from '@/lib/types/shortLinks';

const inputClass =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20';

type Draft = Record<keyof ShortLinkFormValues, string>;

function draftOf(link: ShortLink | null): Draft {
  return {
    slug: link?.slug ?? '',
    label: link?.label ?? '',
    kind: link?.kind ?? 'web',
    targetDefault: link?.targetDefault ?? 'https://app.theresto.fr/',
    targetIos: link?.targetIos ?? '',
    targetAndroid: link?.targetAndroid ?? '',
    forwardParams: link?.forwardParams ?? 'none',
    src: link?.src ?? '',
    ville: link?.ville ?? '',
    persona: link?.persona ?? '',
    campaign: link?.campaign ?? '',
    // <input type="datetime-local"> : heure locale du navigateur.
    expiresAt: link?.expiresAt ? toLocalInput(link.expiresAt) : '',
  };
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function valuesOf(draft: Draft): ShortLinkFormValues {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    slug: draft.slug.trim().toLowerCase(),
    label: opt(draft.label),
    kind: draft.kind as ShortLinkFormValues['kind'],
    targetDefault: draft.targetDefault.trim(),
    targetIos: opt(draft.targetIos),
    targetAndroid: opt(draft.targetAndroid),
    forwardParams: draft.forwardParams as ShortLinkFormValues['forwardParams'],
    src: opt(draft.src),
    ville: opt(draft.ville),
    persona: opt(draft.persona) as ShortLinkFormValues['persona'],
    campaign: opt(draft.campaign),
    expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
  };
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

/** Création (link = null) ou modification complète d'un lien court. */
export function ShortLinkFormModal({
  link,
  domain,
  onClose,
  onSaved,
}: {
  link: ShortLink | null;
  domain: string;
  onClose: () => void;
  onSaved?: (link: ShortLink) => void;
}) {
  const create = useCreateShortLink();
  const update = useUpdateShortLink();
  const [draft, setDraft] = useState<Draft>(() => draftOf(link));
  const [error, setError] = useState('');
  const pending = create.isPending || update.isPending;
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  const slugChanged = link !== null && draft.slug.trim().toLowerCase() !== link.slug;

  const submit = async () => {
    const values = valuesOf(draft);
    // Même validation que le serveur, pour répondre tout de suite ; le serveur revérifie.
    const check = validateShortLinkInput(values);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError('');
    try {
      const saved = link
        ? await update.mutateAsync({ id: link.id, values, expectedUpdatedAt: link.updatedAt })
        : await create.mutateAsync(values);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-label={link ? 'Modifier le lien' : 'Nouveau lien'} className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-sm font-semibold text-gray-900">{link ? `Modifier ${domain}/${link.slug}` : 'Nouveau lien'}</h3>
          <button onClick={onClose} disabled={pending} aria-label="Fermer" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="slug" label="Slug" hint={`https://${domain}/${draft.slug.trim().toLowerCase() || '…'}`}>
              <input id="slug" className={inputClass} value={draft.slug} onChange={set('slug')} placeholder="flyer-lyon" autoFocus={!link} />
            </Field>
            <Field id="label" label="Libellé interne" hint="Jamais publié.">
              <input id="label" className={inputClass} value={draft.label} onChange={set('label')} maxLength={200} />
            </Field>
            <Field id="kind" label="Type">
              <select id="kind" className={inputClass} value={draft.kind} onChange={set('kind')}>
                <option value="web">Web (cible ci-dessous)</option>
                <option value="download">Téléchargement (stores par défaut)</option>
              </select>
            </Field>
            <Field id="forward" label="Paramètres transmis à la cible web">
              <select id="forward" className={inputClass} value={draft.forwardParams} onChange={set('forwardParams')}>
                <option value="none">Aucun</option>
                <option value="utm">utm_* et src</option>
              </select>
            </Field>
          </div>

          {slugChanged && (
            <p role="status" className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              Changer le slug casse les QR déjà imprimés avec l&apos;ancien : ils renverront vers l&apos;App comme un lien inconnu.
            </p>
          )}

          <Field id="target-default" label="Cible par défaut (ordinateur et autres)">
            <input id="target-default" className={inputClass} value={draft.targetDefault} onChange={set('targetDefault')} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="target-ios" label="Cible iPhone (facultative)" hint={draft.kind === 'download' ? 'Vide : lien App Store des réglages.' : 'Vide : cible par défaut.'}>
              <input id="target-ios" className={inputClass} value={draft.targetIos} onChange={set('targetIos')} />
            </Field>
            <Field id="target-android" label="Cible Android (facultative)" hint={draft.kind === 'download' ? 'Vide : lien Google Play des réglages.' : 'Vide : cible par défaut.'}>
              <input id="target-android" className={inputClass} value={draft.targetAndroid} onChange={set('targetAndroid')} />
            </Field>
          </div>
          <p className="text-[11px] text-gray-400">
            Cibles autorisées : https vers theresto.fr (app., hub., widget.), apps.apple.com, ou la fiche Google Play com.theresto…
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field id="persona" label="Persona">
              <select id="persona" className={inputClass} value={draft.persona} onChange={set('persona')}>
                <option value="">Aucune</option>
                <option value="client">Client</option>
                <option value="pro">Pro</option>
              </select>
            </Field>
            <Field id="ville" label="Ville"><input id="ville" className={inputClass} value={draft.ville} onChange={set('ville')} placeholder="lyon" /></Field>
            <Field id="campaign" label="Campagne"><input id="campaign" className={inputClass} value={draft.campaign} onChange={set('campaign')} placeholder="salon-2026" /></Field>
            <Field id="src" label="Source"><input id="src" className={inputClass} value={draft.src} onChange={set('src')} placeholder="flyer" /></Field>
          </div>
          <Field id="expires" label="Expiration (facultative)" hint="Après cette date, le QR renvoie vers l'App, ses scans restent comptés.">
            <input id="expires" type="datetime-local" className={inputClass} value={draft.expiresAt} onChange={set('expiresAt')} />
          </Field>

          {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={pending} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl disabled:opacity-50">Annuler</button>
            <button onClick={submit} disabled={pending} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl disabled:opacity-40">
              {pending ? 'Enregistrement…' : link ? 'Enregistrer' : 'Créer le lien'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
