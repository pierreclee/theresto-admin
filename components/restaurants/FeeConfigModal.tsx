'use client';

import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useSetAdminFee } from '@/lib/hooks/useRestaurants';

interface FeeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  currentFee: number;
}

export function FeeConfigModal({ isOpen, onClose, restaurantId, currentFee }: FeeConfigModalProps) {
  const [fee, setFee] = useState(currentFee);
  const { mutate, isPending, error } = useSetAdminFee();

  const EXAMPLE_REVENUE = 1000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clampedFee = Math.min(30, Math.max(0, fee));
    if (clampedFee !== fee) {
      setFee(clampedFee);
      return;
    }
    mutate(
      { restaurantId, feePercent: fee },
      { onSuccess: () => onClose() },
    );
  };

  const estimatedCommission = (EXAMPLE_REVENUE * fee) / 100;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier la commission" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fee" className="block text-sm font-medium text-gray-700">
            Taux de commission (%)
          </label>
          <input
            type="range"
            id="fee"
            min="0"
            max="30"
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
            className="w-full mt-2"
          />
          <p className="text-2xl font-bold text-blue-600 mt-2">{fee}%</p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Exemple de calcul</p>
          <p className="text-sm font-semibold mt-2">
            Sur €{EXAMPLE_REVENUE.toFixed(2)} de CA, TheResto percevrait €{estimatedCommission.toFixed(2)}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error.message}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
