'use client';

import { useState } from 'react';
import {
  X,
  Star,
  Calendar,
  TrendingUp,
  ShieldAlert,
  ChevronRight,
  Store,
} from 'lucide-react';
import type { AppUser } from '@/lib/types/user';
import { useUserCrmProfile } from '@/lib/hooks/useUsers';
import { ModerationBadge } from './ModerationBadge';
import { RoleBadge } from './RoleBadge';
import { ModerationModal } from './ModerationModal';
import { useModerateUser } from '@/lib/hooks/useUsers';
import type { ModerationAction } from '@/lib/types/user';

const bookingStatusLabel: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  completed: 'Terminé',
  cancelled: 'Annulé',
  refused: 'Refusé',
};

const bookingStatusColor: Record<string, string> = {
  completed: 'text-green-600',
  cancelled: 'text-red-500',
  refused: 'text-red-400',
  pending: 'text-orange-500',
  confirmed: 'text-blue-500',
};

interface Props {
  user: AppUser;
  onClose: () => void;
}

export function UserDetailModal({ user, onClose }: Props) {
  const [showModerationModal, setShowModerationModal] = useState(false);
  const { data: profile, isPending } = useUserCrmProfile(user.id);
  const { mutateAsync: moderateUser } = useModerateUser();

  const handleModerate = async (action: ModerationAction, reason?: string) => {
    await moderateUser({ userId: user.id, action, reason });
  };

  const formatDate = (v: string | Date | null | undefined) => {
    if (!v) return '—';
    const d = typeof v === 'string' ? new Date(v) : v;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-start justify-end p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#0F1629] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ModerationBadge status={user.moderationStatus} />
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Roles + info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-400 mb-1.5">Rôles</p>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((r) => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-400 mb-1">Fidélité</p>
                <div className="flex items-center gap-1.5">
                  <Star size={13} className="text-yellow-500" />
                  <span className="text-sm font-semibold text-gray-800">{user.loyaltyPoints} pts</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{user.lifetimePoints} pts cumulés</p>
              </div>
            </div>

            {user.phoneNumber && (
              <div className="text-sm text-gray-600">
                <span className="text-gray-400">Tél : </span>{user.phoneNumber}
              </div>
            )}

            <div className="text-xs text-gray-400">
              Inscrit le {formatDate(user.createdAt)}
            </div>

            {/* Stats */}
            {isPending ? (
              <div className="grid grid-cols-3 gap-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-3 h-20" />
                ))}
              </div>
            ) : profile && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{profile.stats.totalBookings}</p>
                    <p className="text-xs text-gray-400">Réservations</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{profile.stats.completionRate}%</p>
                    <p className="text-xs text-gray-400">Taux arrivée</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(profile.stats.totalSpent)}</p>
                    <p className="text-xs text-gray-400">Dépensé</p>
                  </div>
                </div>

                {/* Favorite restaurants */}
                {profile.favoriteRestaurants.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                      Restaurants favoris
                    </p>
                    <div className="space-y-1.5">
                      {profile.favoriteRestaurants.slice(0, 3).map((r) => (
                        <div key={r.restaurantId} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <Store size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{r.restaurantName}</span>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{r.bookingCount} visite{r.bookingCount > 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent bookings */}
                {profile.recentBookings.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                      Dernières réservations
                    </p>
                    <div className="space-y-1.5">
                      {profile.recentBookings.slice(0, 5).map((b) => (
                        <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-700 truncate">{b.restaurantName}</p>
                            <p className="text-xs text-gray-400">{formatDate(b.bookingDate)} · {b.numberOfGuests} pers.</p>
                          </div>
                          <span className={`text-xs font-medium flex-shrink-0 ${bookingStatusColor[b.status] ?? 'text-gray-500'}`}>
                            {bookingStatusLabel[b.status] ?? b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Moderation info if suspended/banned */}
            {user.moderationStatus !== 'active' && user.moderationReason && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert size={13} className="text-red-500" />
                  <p className="text-xs font-medium text-red-700">
                    {user.moderationStatus === 'banned' ? 'Compte banni' : 'Compte suspendu'}
                  </p>
                </div>
                <p className="text-xs text-red-600">{user.moderationReason}</p>
                {user.moderatedAt && (
                  <p className="text-xs text-red-400 mt-1">Le {formatDate(user.moderatedAt)}</p>
                )}
              </div>
            )}
          </div>

          {/* Footer — moderation action */}
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={() => setShowModerationModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 hover:border-orange-200 hover:bg-orange-50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
                <span className="text-sm font-medium text-gray-700">
                  {user.moderationStatus === 'active' ? 'Suspendre ou bannir' : 'Modifier la modération'}
                </span>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-orange-400" />
            </button>
          </div>
        </div>
      </div>

      {showModerationModal && (
        <div className="relative z-50">
          <ModerationModal
            user={user}
            onConfirm={handleModerate}
            onClose={() => setShowModerationModal(false)}
          />
        </div>
      )}
    </>
  );
}
