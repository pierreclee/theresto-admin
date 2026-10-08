'use client';

import { useState } from 'react';
import { X, Copy, Check, Mail, UserPlus } from 'lucide-react';
import {
  inviteRestaurantOwnerAction,
  type InviteRestaurantOwnerResult,
} from '@/lib/actions/invitations';

type Invitation = Extract<InviteRestaurantOwnerResult, { ok: true }>;

interface Props {
  onClose: () => void;
  /** Pre-filled and locked (e.g. when opened from a user's detail panel). */
  initialEmail?: string;
}

export function InviteRestaurantModal({ onClose, initialEmail }: Props) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsPending(true);
    try {
      const result = await inviteRestaurantOwnerAction(email.trim());
      if (result.ok) {
        setInvitation(result);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création de l'invitation");
    } finally {
      setIsPending(false);
    }
  };

  const handleCopy = async () => {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.onboardingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Inviter à créer un restaurant</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        {invitation ? (
          <div className="p-5 space-y-4">
            {invitation.emailSent && (
              <p className="flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                <Mail size={14} className="shrink-0 mt-0.5" />
                Invitation envoyée par email à {invitation.email}.
              </p>
            )}

            {!invitation.hasAccount && (
              <p className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <UserPlus size={14} className="shrink-0 mt-0.5" />
                Pas encore de compte TheResto : le lien l’invite à s’inscrire avec cette adresse,
                puis l’amène directement sur le formulaire de son restaurant.
              </p>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Lien d’invitation</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={invitation.onboardingUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Valable jusqu’au {new Date(invitation.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.
                Utilisable uniquement avec un compte à l’adresse {invitation.email}.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              Si la personne n’a pas encore de compte, le lien l’invitera à s’inscrire avec cette adresse.
              Une éventuelle invitation précédente sera annulée.
            </p>

            <input
              type="email"
              required
              autoFocus={!initialEmail}
              readOnly={!!initialEmail}
              placeholder="email@restaurant.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] read-only:bg-gray-50 read-only:text-gray-600"
            />

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2">
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
                disabled={!email.trim() || isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors disabled:opacity-40"
              >
                {isPending ? 'Envoi…' : "Envoyer l'invitation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
