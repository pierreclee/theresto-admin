'use client';

import { useState } from 'react';
import { X, Star, Zap, Check } from 'lucide-react';
import { useUpdateSubscription } from '@/lib/hooks/useRestaurants';

const premiumFeatures = [
  'Statistiques avancées',
  'Gestion de service & cuisine',
  'Menus & inventaire',
  'Gestion du personnel & planning',
  'Plan de salle interactif',
  'Pré-commandes & click & collect',
];

interface Props {
  restaurantId: string;
  restaurantName: string;
  currentPlan: 'free' | 'premium';
  onClose: () => void;
}

export function SubscriptionModal({ restaurantId, restaurantName, currentPlan, onClose }: Props) {
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useUpdateSubscription();

  const targetPlan = currentPlan === 'free' ? 'premium' : 'free';
  const isUpgrade = targetPlan === 'premium';

  const handleConfirm = async () => {
    setError('');
    try {
      await mutateAsync({ restaurantId, plan: targetPlan });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du changement de plan');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isUpgrade
              ? <Star size={16} className="text-yellow-500" />
              : <Zap size={16} className="text-gray-400" />
            }
            <h3 className="text-sm font-semibold text-gray-900">
              {isUpgrade ? 'Passer en Premium' : 'Rétrograder en Free'}
            </h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Restaurant name */}
          <p className="text-sm text-gray-600">
            Restaurant : <span className="font-semibold text-gray-900">{restaurantName}</span>
          </p>

          {/* Plan transition */}
          <div className="flex items-center gap-3">
            <div className={`flex-1 text-center py-3 rounded-xl border text-sm font-semibold ${
              currentPlan === 'free'
                ? 'bg-gray-50 border-gray-200 text-gray-500 line-through'
                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              {currentPlan === 'free' ? 'Free' : 'Premium ★'}
            </div>
            <span className="text-gray-400 text-lg">→</span>
            <div className={`flex-1 text-center py-3 rounded-xl border text-sm font-semibold ${
              targetPlan === 'premium'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700 ring-1 ring-yellow-300'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
              {targetPlan === 'premium' ? 'Premium ★' : 'Free'}
            </div>
          </div>

          {/* Premium features list */}
          {isUpgrade ? (
            <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4">
              <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mb-2">
                Fonctionnalités activées
              </p>
              <ul className="space-y-1.5">
                {premiumFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-yellow-800">
                    <Check size={12} className="text-yellow-600 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-red-50 rounded-xl border border-red-100 p-4">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">
                Fonctionnalités perdues
              </p>
              <ul className="space-y-1.5">
                {premiumFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-red-700">
                    <X size={12} className="text-red-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 ${
              isUpgrade
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-gray-700 hover:bg-gray-800'
            }`}
          >
            {isPending ? 'Traitement…' : isUpgrade ? 'Activer Premium' : 'Rétrograder'}
          </button>
        </div>
      </div>
    </div>
  );
}
