'use client';

import { useState } from 'react';
import { AlertTriangle, Pencil, Smartphone, X } from 'lucide-react';
import { TotpCodeField } from '@/components/shared/TotpCodeField';
import { useAppVersionPolicies, useUpdateAppVersionPolicy } from '@/lib/hooks/useAppVersionPolicies';
import { ActionError } from '@/lib/api/actionResult';
import {
  draftFromPolicy,
  draftRaisesMinimum,
  isConflict,
  MAX_MESSAGE_LENGTH,
  parseAppVersionDraft,
  PLATFORM_NAMES,
  RAISE_MINIMUM_WARNING,
  raisesMinimum,
  STORE_URL_PREFIX,
  type AppVersionDraft,
} from '@/lib/utils/appVersion';
import type { AppVersionPolicy, AppVersionPolicyInput } from '@/lib/types/appVersion';

const inputClass =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Modification d'une plateforme en deux étapes : saisie, puis code 2FA (avertissement si le minimum monte). */
function AppVersionModal({ policy, onClose }: { policy: AppVersionPolicy; onClose: () => void }) {
  const { mutateAsync } = useUpdateAppVersionPolicy();
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [draft, setDraft] = useState<AppVersionDraft>(() => draftFromPolicy(policy));
  const [input, setInput] = useState<AppVersionPolicyInput | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  // Après un conflit : la saisie repart des valeurs relues dès qu'elles arrivent.
  const [staleUpdatedAt, setStaleUpdatedAt] = useState<string | null>(null);
  if (staleUpdatedAt !== null && staleUpdatedAt !== policy.updatedAt) {
    setStaleUpdatedAt(null);
    setDraft(draftFromPolicy(policy));
  }

  const name = PLATFORM_NAMES[policy.platform];
  const set = (key: keyof AppVersionDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const goToConfirm = () => {
    const parsed = parseAppVersionDraft(policy.platform, draft, policy.updatedAt);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    setInput(parsed.value);
    setStep('confirm');
  };

  const confirm = async () => {
    if (!input) return;
    setError('');
    setPending(true);
    try {
      await mutateAsync({ ...input, totpCode: code });
      onClose();
    } catch (e) {
      setCode('');
      const errorCode = e instanceof ActionError ? e.code : undefined;
      setError(e instanceof Error ? e.message : 'La modification a échoué.');
      // Conflit : retour à la saisie, reprise des valeurs relues. Code TOTP refusé (par
      // Supabase Auth ou, au-delà de 5 min, par l'Edge Function) : on reste sur l'étape du code.
      if (isConflict(errorCode)) {
        setStaleUpdatedAt(policy.updatedAt);
        setInput(null);
        setStep('form');
      }
    } finally {
      setPending(false);
    }
  };

  const raising = input ? raisesMinimum(policy, input) : draftRaisesMinimum(policy, draft);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Versions ${name}`} className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Versions de l&apos;app {name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Étape {step === 'form' ? '1' : '2'} sur 2</p>
          </div>
          <button onClick={onClose} disabled={pending} aria-label="Fermer" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'form' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field id="min-version" label="Version minimale"><input id="min-version" className={inputClass} value={draft.minVersion} onChange={set('minVersion')} placeholder="1.2.0" autoFocus /></Field>
                <Field id="min-build" label="Build minimal"><input id="min-build" inputMode="numeric" className={inputClass} value={draft.minBuild} onChange={set('minBuild')} /></Field>
                <Field id="rec-version" label="Version recommandée"><input id="rec-version" className={inputClass} value={draft.recommendedVersion} onChange={set('recommendedVersion')} placeholder="1.3.0" /></Field>
                <Field id="rec-build" label="Build recommandé"><input id="rec-build" inputMode="numeric" className={inputClass} value={draft.recommendedBuild} onChange={set('recommendedBuild')} /></Field>
              </div>
              <Field id="store-url" label="Lien du store">
                <input id="store-url" className={inputClass} value={draft.storeUrl} onChange={set('storeUrl')} placeholder={`${STORE_URL_PREFIX[policy.platform]}…`} />
              </Field>
              <Field id="message" label={`Message affiché (facultatif, ${MAX_MESSAGE_LENGTH} caractères au plus)`}>
                <textarea id="message" rows={3} maxLength={MAX_MESSAGE_LENGTH} className={inputClass} value={draft.message} onChange={set('message')} />
              </Field>
              <p className="text-xs text-gray-400">
                Même numéro de build sur Android et iOS, augmenté à chaque publication. Réglez d&apos;abord la version recommandée, puis le minimum.
              </p>
            </>
          ) : (
            input && (
              <>
                <ul className="space-y-1.5 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                  <li className="flex justify-between gap-3"><span className="text-gray-500">Minimum</span><span className="font-semibold text-gray-900">{input.minVersion} (build {input.minBuild})</span></li>
                  <li className="flex justify-between gap-3"><span className="text-gray-500">Recommandée</span><span className="font-semibold text-gray-900">{input.recommendedVersion} (build {input.recommendedBuild})</span></li>
                  <li className="flex justify-between gap-3"><span className="text-gray-500">Store</span><span className="font-medium text-gray-900 truncate max-w-[60%]">{input.storeUrl ?? 'aucun'}</span></li>
                  <li className="flex justify-between gap-3"><span className="text-gray-500">Message</span><span className="text-gray-900">{input.message ? 'oui' : 'texte par défaut'}</span></li>
                </ul>
                <TotpCodeField value={code} onChange={setCode} onSubmit={confirm} busy={pending} hint="Requis pour toute modification : code de moins de 5 minutes, même si vous êtes déjà connecté." />
              </>
            )
          )}

          {raising && (
            <p role="status" className="flex gap-2.5 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {RAISE_MINIMUM_WARNING}
            </p>
          )}
          {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={step === 'confirm' ? () => { setError(''); setCode(''); setStep('form'); } : onClose}
              disabled={pending}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl disabled:opacity-50"
            >
              {step === 'confirm' ? 'Retour' : 'Annuler'}
            </button>
            {step === 'form' ? (
              <button onClick={goToConfirm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl">Continuer</button>
            ) : (
              <button onClick={confirm} disabled={code.length !== 6 || pending} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl disabled:opacity-40">
                {pending ? 'Mise à jour…' : raising ? 'Relever le minimum' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/** Réglage « Versions de l'app mobile » : minimum (bloquant) et recommandée (feuille), par plateforme. */
export function AppVersionPoliciesCard() {
  const { data: policies, isPending, error } = useAppVersionPolicies();
  const [editing, setEditing] = useState<AppVersionPolicy['platform'] | null>(null);
  const editedPolicy = policies?.find((p) => p.platform === editing) ?? null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Versions de l&apos;app mobile</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Sous la version minimale, l&apos;app est bloquée sur « Mise à jour nécessaire » ; sous la recommandée, une mise à jour est proposée.
          Toute modification exige une vérification en deux étapes.
        </p>
      </div>
      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {error.message}
        </div>
      ) : isPending || !policies ? (
        <div className="p-5 space-y-3 animate-pulse">{[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {policies.map((policy) => (
            <div key={policy.platform} className="px-5 py-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                <Smartphone size={15} className="text-gray-500" />
              </div>
              <dl className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm min-w-0">
                <div><dt className="text-xs text-gray-400">{PLATFORM_NAMES[policy.platform]} — minimum</dt><dd className="font-semibold text-gray-900">{policy.minVersion} <span className="text-gray-400 font-normal">({policy.minBuild})</span></dd></div>
                <div><dt className="text-xs text-gray-400">Recommandée</dt><dd className="font-semibold text-gray-900">{policy.recommendedVersion} <span className="text-gray-400 font-normal">({policy.recommendedBuild})</span></dd></div>
                <div className="min-w-0"><dt className="text-xs text-gray-400">Store</dt><dd className="text-gray-700 truncate" title={policy.storeUrl ?? undefined}>{policy.storeUrl ?? 'aucun lien'}</dd></div>
                <div><dt className="text-xs text-gray-400">Modifié le</dt><dd className="text-gray-700">{formatDate(policy.updatedAt)}</dd></div>
              </dl>
              <button
                onClick={() => setEditing(policy.platform)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 flex-shrink-0"
              >
                <Pencil size={12} />
                Modifier
              </button>
            </div>
          ))}
        </div>
      )}
      {editedPolicy && <AppVersionModal key={editedPolicy.platform} policy={editedPolicy} onClose={() => setEditing(null)} />}
    </div>
  );
}
