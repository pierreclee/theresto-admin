'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, CreditCard, Pencil, ShieldCheck, X } from 'lucide-react';
import {
  PLAN_LABELS,
  formatPlanPrice,
  useSubscriptionPrices,
  useUpdateSubscriptionPrice,
} from '@/lib/hooks/useSubscriptionPrices';
import type { SubscriptionPriceInfo } from '@/lib/types/config';

// ─── Modale de modification (2 étapes : montant, puis code 2FA) ──────────────

function EditPriceModal({ price, onClose }: { price: SubscriptionPriceInfo; onClose: () => void }) {
  const [step, setStep] = useState<'amount' | 'confirm'>('amount');
  const [draft, setDraft] = useState(price.amount.toString());
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useUpdateSubscriptionPrice();

  const amount = Number(draft.replace(',', '.'));
  const amountValid =
    Number.isFinite(amount) && amount >= 1 && amount <= 10000 && Math.round(amount * 100) === amount * 100;
  const newPrice = { amount, currency: price.currency };

  const goToConfirm = () => {
    if (!amountValid) {
      setError('Montant invalide (entre 1 et 10 000 €, 2 décimales maximum)');
      return;
    }
    if (amount === price.amount) {
      setError('Le montant est identique au prix actuel');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setError('');
    try {
      await mutateAsync({ plan: price.plan, amount, expectedPriceId: price.priceId, totpCode: code });
      onClose();
    } catch (e) {
      setCode('');
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour du prix');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={isPending ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Prix du plan {PLAN_LABELS[price.plan]}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Étape {step === 'amount' ? '1' : '2'} sur 2</p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Fermer"
          >
            <X size={15} />
          </button>
        </div>

        {step === 'amount' ? (
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="price-amount" className="block text-xs font-medium text-gray-600 mb-1.5">
                Nouveau prix mensuel HT
              </label>
              <div className="relative">
                <input
                  id="price-amount"
                  type="text"
                  inputMode="decimal"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goToConfirm()}
                  autoFocus
                  className="w-full text-lg font-semibold border border-gray-200 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Prix actuel : {formatPlanPrice(price)} / mois</p>
            </div>

            <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <p>
                Un nouveau prix est créé dans Stripe et s&apos;applique immédiatement aux nouveaux abonnements.
                Les abonnés actuels conservent leur tarif.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={goToConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors"
              >
                Continuer
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-sm text-gray-400 line-through">{formatPlanPrice(price)}</span>
              <ArrowRight size={15} className="text-gray-400" />
              <span className="text-lg font-bold text-gray-900">{formatPlanPrice(newPrice)}</span>
              <span className="text-xs text-gray-400">/ mois HT</span>
            </div>

            <div>
              <label htmlFor="totp-code" className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                <ShieldCheck size={13} className="text-[#FF6B35]" />
                Code de votre application d&apos;authentification
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && !isPending && handleConfirm()}
                autoFocus
                disabled={isPending}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.4em] font-mono border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 disabled:opacity-60"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Requis pour toute modification de prix, même si vous êtes déjà connecté.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setError('');
                  setStep('amount');
                }}
                disabled={isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Retour
              </button>
              <button
                onClick={handleConfirm}
                disabled={code.length !== 6 || isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl transition-colors disabled:opacity-40"
              >
                {isPending ? 'Mise à jour…' : 'Confirmer le nouveau prix'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Carte ───────────────────────────────────────────────────────────────────

export function SubscriptionPricesCard() {
  const { data: prices, isPending, error } = useSubscriptionPrices();
  const [editing, setEditing] = useState<SubscriptionPriceInfo | null>(null);

  // Du plus cher au moins cher
  const sorted = [...(prices ?? [])].sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Tarifs des abonnements</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Lus depuis Stripe. Toute modification exige une vérification en deux étapes.
        </p>
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} />
          Impossible de charger les prix depuis Stripe
        </div>
      ) : isPending ? (
        <div className="px-5 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100" />
                <div className="h-3.5 w-32 bg-gray-100 rounded" />
              </div>
              <div className="h-7 w-20 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">Aucun prix configuré dans Stripe.</p>
      ) : (
        <div className="px-5">
          {sorted.map((price) => (
            <div
              key={price.plan}
              className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                  <CreditCard size={15} className="text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">Plan {PLAN_LABELS[price.plan]}</p>
                  <p className="text-xs text-gray-400 truncate">
                    Depuis le {new Date(price.since).toLocaleDateString('fr-FR')} ·{' '}
                    <span className="font-mono">{price.priceId}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-100 px-3 py-1 rounded-lg">
                  {formatPlanPrice(price)} / mois
                </span>
                <button
                  onClick={() => setEditing(price)}
                  className="w-7 h-7 rounded-lg border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 transition-colors"
                  aria-label={`Modifier le prix du plan ${PLAN_LABELS[price.plan]}`}
                >
                  <Pencil size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <EditPriceModal price={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
