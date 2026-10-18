'use client';

import type { SubscriptionPlanKey } from '@/lib/utils/subscriptionPlan';
import { useState } from 'react';
import { TotpCodeField } from '@/components/shared/TotpCodeField';
import { X, Check } from 'lucide-react';
import { useUpdateSubscription } from '@/lib/hooks/useRestaurants';
import { formatPlanPrice, useSubscriptionPrices } from '@/lib/hooks/useSubscriptionPrices';

type Plan = SubscriptionPlanKey;

const PLANS: { key: Plan; label: string; badgeClass: string; cardClass: string; ringClass: string; features: string[] }[] = [
  {
    key: 'essentiel',
    label: 'Essentiel',
    badgeClass: 'bg-gray-50 text-gray-500 border-gray-200',
    cardClass: 'border-gray-200 bg-gray-50',
    ringClass: 'ring-gray-400',
    features: [],
  },
  {
    key: 'croissance',
    label: 'Croissance',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    cardClass: 'border-blue-200 bg-blue-50',
    ringClass: 'ring-blue-400',
    features: [
      'Statistiques de base',
      'Gestion de service & cuisine',
      'Menus & inventaire',
    ],
  },
  {
    key: 'liberte',
    label: 'Liberté',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    cardClass: 'border-purple-200 bg-purple-50',
    ringClass: 'ring-purple-400',
    features: [
      'Statistiques avancées',
      'Gestion de service & cuisine',
      'Menus & inventaire',
      'Gestion du personnel & planning',
      'Plan de salle interactif',
      'Pré-commandes & click & collect',
    ],
  },
];

interface Props {
  restaurantId: string;
  restaurantName: string;
  currentPlan: SubscriptionPlanKey;
  onClose: () => void;
}

export function SubscriptionModal({ restaurantId, restaurantName, currentPlan, onClose }: Props) {
  const [targetPlan, setTargetPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<'plan' | 'confirm'>('plan');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useUpdateSubscription();
  // Prix courants depuis Stripe
  const { data: prices } = useSubscriptionPrices();
  const priceLabel = (plan: Plan) => {
    const price = prices?.find((p) => p.plan === plan);
    return price ? `${formatPlanPrice(price)} / mois` : null;
  };

  const handleConfirm = async () => {
    if (!targetPlan) return;
    setError('');
    try {
      await mutateAsync({ restaurantId, plan: targetPlan, totpCode: code });
      onClose();
    } catch (e) {
      // Le code est à usage unique : on le vide pour en saisir un nouveau.
      setCode('');
      setError(e instanceof Error && e.message ? e.message : 'Erreur lors du changement de plan');
    }
  };

  const selected = PLANS.find((p) => p.key === targetPlan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Modifier l&apos;abonnement</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Restaurant : <span className="font-semibold text-gray-900">{restaurantName}</span>
          </p>

          {step === 'plan' && (
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              const isSelected = plan.key === targetPlan;
              return (
                <button
                  key={plan.key}
                  disabled={isCurrent}
                  onClick={() => setTargetPlan(plan.key)}
                  className={`relative flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs font-semibold transition-all ${
                    isCurrent
                      ? `${plan.cardClass} opacity-60 cursor-default`
                      : isSelected
                      ? `${plan.cardClass} ring-2 ring-offset-1 ${plan.ringClass}`
                      : 'border-gray-100 bg-white hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-gray-700 text-white text-[10px] rounded-full whitespace-nowrap">
                      Actuel
                    </span>
                  )}
                  {isSelected && (
                    <Check size={10} className="absolute top-1.5 right-1.5 text-gray-600" />
                  )}
                  <span className={`px-2 py-0.5 rounded-full border ${plan.badgeClass}`}>
                    {plan.label}
                  </span>
                  {priceLabel(plan.key) && (
                    <span className="text-[10px] text-gray-400">{priceLabel(plan.key)}</span>
                  )}
                </button>
              );
            })}
          </div>
          )}

          {step === 'confirm' && selected && (
            <>
              <p className="py-3 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700">
                Passage de <span className="font-semibold">{PLANS.find((p) => p.key === currentPlan)?.label}</span> à{' '}
                <span className="font-semibold">{selected.label}</span>. Le taux de commission des paiements en ligne
                suit le plan du restaurant et sera modifié.
              </p>
              <TotpCodeField
                value={code}
                onChange={setCode}
                onSubmit={handleConfirm}
                busy={isPending}
                hint="Requis pour tout changement de plan, car il modifie le taux de commission."
              />
            </>
          )}

          {/* Features of selected plan */}
          {step === 'plan' && selected && selected.features.length > 0 && (
            <div className={`rounded-xl border p-3 ${selected.cardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-gray-600">
                Fonctionnalités incluses
              </p>
              <ul className="space-y-1">
                {selected.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-700">
                    <Check size={11} className="text-gray-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={
              step === 'confirm'
                ? () => {
                    setError('');
                    setCode('');
                    setStep('plan');
                  }
                : onClose
            }
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {step === 'confirm' ? 'Retour' : 'Annuler'}
          </button>
          {step === 'plan' ? (
            <button
              onClick={() => {
                setError('');
                setStep('confirm');
              }}
              disabled={!targetPlan}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors disabled:opacity-40"
            >
              {targetPlan ? `Passer en ${selected?.label}` : 'Sélectionner un plan'}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={code.length !== 6 || isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors disabled:opacity-40"
            >
              {isPending ? 'Traitement…' : `Confirmer le passage en ${selected?.label}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
