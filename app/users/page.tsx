'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useUsers } from '@/lib/hooks/useUsers';
import { ModerationBadge } from '@/components/users/ModerationBadge';
import { RoleBadge } from '@/components/users/RoleBadge';
import { UserDetailModal } from '@/components/users/UserDetailModal';
import type { AppUser } from '@/lib/types/user';

const roleOptions = [
  { value: '', label: 'Tous les rôles' },
  { value: 'customer', label: 'Clients' },
  { value: 'restaurateur', label: 'Restaurateurs' },
  { value: 'cook', label: 'Cuisiniers' },
  { value: 'server', label: 'Serveurs' },
];

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'banned', label: 'Bannis' },
];

function UserRow({ user, onClick }: { user: AppUser; onClick: () => void }) {
  const primaryRole = user.roles[0] ?? 'customer';
  const joinDate = user.createdAt
    ? user.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={onClick}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0F1629] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1">
          <RoleBadge role={primaryRole} />
          {user.roles.length > 1 && (
            <span className="text-xs text-gray-400 self-center">+{user.roles.length - 1}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <ModerationBadge status={user.moderationStatus} />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span className="text-yellow-500 text-xs">★</span>
          {user.loyaltyPoints.toLocaleString('fr-FR')}
        </div>
      </td>
      <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">{joinDate}</td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
              <div>
                <div className="h-3.5 w-32 bg-gray-100 rounded mb-1.5" />
                <div className="h-3 w-44 bg-gray-50 rounded" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3.5"><div className="h-5 w-16 bg-gray-100 rounded-full" /></td>
          <td className="px-4 py-3.5"><div className="h-5 w-12 bg-gray-100 rounded-full" /></td>
          <td className="px-4 py-3.5"><div className="h-3.5 w-10 bg-gray-100 rounded" /></td>
          <td className="px-4 py-3.5"><div className="h-3 w-20 bg-gray-50 rounded" /></td>
        </tr>
      ))}
    </>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const { users, isPending, error, hasMore, loadMore } = useUsers({
    statusFilter: statusFilter || undefined,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (roleFilter && !u.roles.includes(roleFilter)) return false;
      return true;
    });
  }, [users, search, roleFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Utilisateurs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {isPending
            ? 'Chargement…'
            : `${filtered.length} utilisateur${filtered.length !== 1 ? 's' : ''} affiché${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Filters */}
        <div className="flex gap-3 px-5 py-4 border-b border-gray-50 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] bg-white"
            >
              {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] bg-white"
            >
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
            Erreur de chargement des utilisateurs
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Utilisateur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Rôle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Points</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Inscription</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isPending ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <UserRow key={user.id} user={user} onClick={() => setSelectedUser(user)} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !isPending && (
          <div className="flex justify-center px-5 py-4 border-t border-gray-50">
            <button
              onClick={loadMore}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B35] transition-colors"
            >
              <ChevronDown size={15} />
              Charger plus
            </button>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
