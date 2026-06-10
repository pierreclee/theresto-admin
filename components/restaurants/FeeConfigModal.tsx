'use client';

import { useState } from 'react';
import { X, Percent } from 'lucide-react';
import { useSetAdminFee } from '@/lib/hooks/useRestaurants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  currentFee: number;
}

const EXAMPLE_REVENUE = 1000;

export function FeeConfigModal({ isOpen, onClose, restaurantId, currentFee }: Props) {
  const [fee, setFee] = useState(currentFee);
  const { mutate, isPending, error } = useSetAdminFee();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clamped = Math.min(30, Math.max(0, fee));
    if (clamped !== fee) { setFee(clamped); return; }
    mutate({ restaurantId, feePercent: fee }, { onSuccess: onClose });
  };

  const estimated = (EXAMPLE_REVENUE * fee) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Percent size={15} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Modifier la commission</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Taux de commission
                </label>
                <span className="text-xl font-bold text-gray-900">{fee}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={0.5}
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
                className="w-full accent-[#FF6B35]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>30%</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Simulation sur {EXAMPLE_REVENUE} € de CA</p>
              <p className="text-sm font-semibold text-gray-800">
                TheResto perçoit{' '}
                <span className="text-[#FF6B35]">{estimated.toFixed(2)} €</span>
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error.message}
              </p>
            )}
          </div>

          <div className="flex gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e55e2a] rounded-xl transition-colors disabled:opacity-50"
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
