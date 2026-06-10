'use client';

import { useState } from 'react';
import { X, CheckCircle2, XCircle, ShieldOff } from 'lucide-react';
import { useApproveRestaurant } from '@/lib/hooks/useRestaurants';

type ApprovalStatus = 'approved' | 'rejected' | 'suspended';

const actions: {
  status: ApprovalStatus;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  requiresReason: boolean;
}[] = [
  {
    status: 'approved',
    label: 'Approuver',
    description: 'Le restaurant est visible et peut accepter des réservations.',
    icon: CheckCircle2,
    color: 'text-green-600',
    requiresReason: false,
  },
  {
    status: 'rejected',
    label: 'Rejeter',
    description: 'La demande est refusée. Un email est envoyé au propriétaire.',
    icon: XCircle,
    color: 'text-red-600',
    requiresReason: true,
  },
  {
    status: 'suspended',
    label: 'Suspendre',
    description: 'Le restaurant est temporairement désactivé.',
    icon: ShieldOff,
    color: 'text-orange-600',
    requiresReason: true,
  },
];

interface Props {
  restaurantId: string;
  restaurantName: string;
  currentStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  onClose: () => void;
}

export function ApprovalModal({ restaurantId, restaurantName, currentStatus, onClose }: Props) {
  const availableActions = actions.filter((a) => a.status !== currentStatus);
  const [selected, setSelected] = useState<ApprovalStatus>(availableActions[0].status);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const { mutateAsync, isPending } = useApproveRestaurant();

  const currentAction = actions.find((a) => a.status === selected)!;

  const handleConfirm = async () => {
    if (currentAction.requiresReason && !reason.trim()) {
      setError('Une raison est obligatoire.');
      return;
    }
    setError('');
    try {
      await mutateAsync({
        restaurantId,
        status: selected,
        reason: currentAction.requiresReason ? reason.trim() : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Statut du restaurant</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Restaurant : <span className="font-semibold text-gray-900">{restaurantName}</span>
          </p>

          <div className="space-y-1.5">
            {availableActions.map((a) => (
              <button
                key={a.status}
                onClick={() => setSelected(a.status)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                  selected === a.status
                    ? 'border-[#FF6B35] bg-orange-50/50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <a.icon size={15} className={`mt-0.5 flex-shrink-0 ${a.color}`} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>
                </div>
              </button>
            ))}
          </div>

          {currentAction.requiresReason && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Raison <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Expliquez la raison..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] resize-none"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

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
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e55e2a] rounded-xl transition-colors disabled:opacity-50"
          >
            {isPending ? 'Traitement…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
