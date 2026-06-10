'use client';

import { useState } from 'react';
import { X, AlertTriangle, ShieldOff, Ban, ShieldCheck } from 'lucide-react';
import type { AppUser, ModerationAction } from '@/lib/types/user';

interface Props {
  user: AppUser;
  onConfirm: (action: ModerationAction, reason?: string) => Promise<void>;
  onClose: () => void;
}

const actions: {
  action: ModerationAction;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  requiresReason: boolean;
}[] = [
  {
    action: 'suspend',
    label: 'Suspendre',
    description: 'L\'utilisateur peut toujours se connecter mais ses accès sont restreints.',
    icon: ShieldOff,
    color: 'text-orange-600',
    requiresReason: true,
  },
  {
    action: 'ban',
    label: 'Bannir',
    description: 'Le compte Firebase est désactivé. L\'utilisateur ne peut plus se connecter.',
    icon: Ban,
    color: 'text-red-600',
    requiresReason: true,
  },
  {
    action: 'activate',
    label: 'Réactiver',
    description: 'Restaure l\'accès complet au compte.',
    icon: ShieldCheck,
    color: 'text-green-600',
    requiresReason: false,
  },
];

export function ModerationModal({ user, onConfirm, onClose }: Props) {
  const availableActions = actions.filter((a) => {
    if (user.moderationStatus === 'active') return a.action !== 'activate';
    return a.action === 'activate';
  });

  const [selected, setSelected] = useState<ModerationAction>(availableActions[0].action);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentAction = actions.find((a) => a.action === selected)!;

  const handleConfirm = async () => {
    if (currentAction.requiresReason && !reason.trim()) {
      setError('Une raison est obligatoire.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(selected, currentAction.requiresReason ? reason.trim() : undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la modération');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-900">Modération du compte</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* User info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-9 h-9 rounded-full bg-[#0F1629] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Action selector (only if multiple options) */}
          {availableActions.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Action</p>
              <div className="space-y-1.5">
                {availableActions.map((a) => (
                  <button
                    key={a.action}
                    onClick={() => setSelected(a.action)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                      selected === a.action
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
            </div>
          )}

          {/* Single action description */}
          {availableActions.length === 1 && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <currentAction.icon size={15} className={`mt-0.5 flex-shrink-0 ${currentAction.color}`} />
              <p className="text-sm text-gray-600">{currentAction.description}</p>
            </div>
          )}

          {/* Reason */}
          {currentAction.requiresReason && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Raison <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Expliquez la raison de cette action..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] resize-none"
              />
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
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e55e2a] rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Traitement…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
