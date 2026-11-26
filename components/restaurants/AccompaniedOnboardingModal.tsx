'use client';

// Parcours accompagné (contrat : docs/features/onboarding-accompagne.md de l'app) :
// l'admin inscrit un restaurateur pendant un rendez-vous. Invitation de 2 heures, aucun
// e-mail : le lien est affiché ici, avec un QR code à faire scanner ou à ouvrir sur la
// tablette du restaurateur. Kbis facultatif à l'inscription (déposé plus tard depuis le Hub).
// Le QR est dessiné dans le navigateur (lib/links/qrCode.ts) : le lien, qui contient le
// jeton, ne part chez aucun service tiers.

import { useMemo, useState } from 'react';
import { X, Copy, Check, ExternalLink, Handshake } from 'lucide-react';
import {
  inviteRestaurantOwnerAction,
  type InviteRestaurantOwnerResult,
} from '@/lib/actions/invitations';
import { useToast } from '@/components/shared/Toaster';
import { buildQrMatrix, qrSvg } from '@/lib/links/qrCode';

type Invitation = Extract<InviteRestaurantOwnerResult, { ok: true }>;

interface Props {
  onClose: () => void;
  /** Adresse préremplie et verrouillée (ex. depuis une demande d'espace restaurant). */
  initialEmail?: string;
  /** Appelé dès qu'une invitation a été créée (quel que soit son parcours). */
  onInvited?: () => void;
}

/**
 * Réponse d'une Edge Function admin-onboarding pas encore à jour : elle ignore `mode` et crée
 * une invitation classique (e-mail, 7 jours). Le lien n'est alors jamais affiché comme un
 * parcours accompagné.
 */
export function notAccompaniedMessage(invitation: Invitation): string {
  const sent = invitation.emailSent
    ? `Une invitation classique (e-mail, 7 jours) a été envoyée à ${invitation.email}.`
    : `Une invitation classique (e-mail, 7 jours) a peut-être été envoyée à ${invitation.email}.`;
  return (
    'L’invitation créée n’est pas accompagnée : la fonction du serveur (admin-onboarding) n’est pas à jour. '
    + `${sent} Aucun lien n’est affiché ici. Vérifiez le déploiement de la fonction avant de recommencer.`
  );
}

/** Image (data: SVG) du QR code du lien, ou null si le rendu échoue. */
export function invitationQrDataUrl(url: string): string | null {
  try {
    const svg = qrSvg(buildQrMatrix(url, { withLogo: false }), {
      darkColor: '#000000',
      lightColor: '#FFFFFF',
      pixels: 240,
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}

export function AccompaniedOnboardingModal({ onClose, initialEmail, onInvited }: Props) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  // Fonction du serveur pas à jour : pas de nouvel essai depuis cette fenêtre (chaque essai
  // créerait une nouvelle invitation classique).
  const [outdated, setOutdated] = useState(false);
  const toast = useToast();

  const qr = useMemo(() => (invitation ? invitationQrDataUrl(invitation.onboardingUrl) : null), [invitation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsPending(true);
    try {
      const result = await inviteRestaurantOwnerAction(email.trim(), 'accompanied');
      if (result.ok) {
        onInvited?.();
        if (result.auditLogged === false) {
          toast("Invitation créée, mais elle n'a pas pu être journalisée. Prévenez l'équipe technique.", 'error');
        }
        // Lien et QR seulement pour une invitation réellement accompagnée (2 heures, sans e-mail).
        if (result.mode === 'accompanied') setInvitation(result);
        else {
          setOutdated(true);
          setError(notAccompaniedMessage(result));
        }
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du lancement du parcours');
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

  const expiry = invitation
    ? new Date(invitation.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Parcours accompagné</h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {invitation ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              Faites scanner ce QR code au restaurateur, ou ouvrez le lien sur sa tablette.
              {!invitation.hasAccount && ' Il créera son compte avec l’adresse ' + invitation.email + ', puis arrivera sur le formulaire de son restaurant.'}
            </p>

            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- image data: générée ici
              <img
                src={qr}
                alt="QR code du lien d’inscription"
                width={240}
                height={240}
                className="mx-auto rounded-lg border border-gray-100"
              />
            ) : (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                QR code indisponible : copiez ou ouvrez le lien.
              </p>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Lien d’inscription</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  aria-label="Lien d’inscription"
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
                <a
                  href={invitation.onboardingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  <ExternalLink size={13} />
                  Ouvrir
                </a>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Valable 2 heures (jusqu’à {expiry}), sans e-mail envoyé. Utilisable uniquement avec un compte à
                l’adresse {invitation.email}. Kbis facultatif : il pourra être déposé plus tard depuis le Hub.
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
            <p className="flex items-start gap-2 text-sm text-gray-600">
              <Handshake size={16} className="shrink-0 mt-0.5 text-[#FF6B35]" />
              <span>
                Pendant un rendez-vous : saisissez l’adresse e-mail du restaurateur. Le lien d’inscription
                (valable 2 heures, aucun e-mail envoyé) s’affichera ici avec un QR code. Une éventuelle invitation
                précédente sera annulée.
              </span>
            </p>

            <input
              type="email"
              required
              autoFocus={!initialEmail}
              readOnly={!!initialEmail}
              aria-label="Adresse e-mail du restaurateur"
              placeholder="email@restaurant.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] read-only:bg-gray-50 read-only:text-gray-600"
            />

            {error && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
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
                disabled={!email.trim() || isPending || outdated}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors disabled:opacity-40"
              >
                {isPending ? 'Création…' : 'Créer le lien'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
