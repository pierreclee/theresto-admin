'use client';

import { usePlatformStats } from '@/lib/hooks/usePlatformStats';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { useRouter } from 'next/navigation';
import {
  Store,
  Clock,
  Star,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sublabel,
  urgent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sublabel?: string;
  urgent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 flex flex-col gap-4 ${urgent ? 'border-orange-200 ring-1 ring-orange-100' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        {urgent && (
          <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Action requise
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-gray-100" />
      <div>
        <div className="h-7 w-16 bg-gray-100 rounded mb-2" />
        <div className="h-4 w-28 bg-gray-50 rounded" />
      </div>
    </div>
  );
}

function ActivityIcon({ success, action }: { success: boolean; action: string }) {
  if (!success) return <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />;
  if (action.includes('approve') || action.includes('approv')) return <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />;
  return <Activity size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />;
}

function formatTimestamp(ts: Date | string | undefined): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const actionLabels: Record<string, string> = {
  restaurant_approved: 'Restaurant approuvé',
  restaurant_rejected: 'Restaurant refusé',
  restaurant_updated: 'Restaurant modifié',
  user_updated: 'Utilisateur modifié',
  config_updated: 'Configuration mise à jour',
  commission_updated: 'Commission modifiée',
};

export default function DashboardPage() {
  const { data: stats, isPending: statsLoading } = usePlatformStats();
  const { data: logsData, isPending: logsLoading } = useAuditLogs({ limit: 6 });
  const router = useRouter();

  const recentLogs = logsData?.logs ?? [];

  return (
    <div className="space-y-6">
      {/* Page intro */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Vue d&apos;ensemble</h2>
        <p className="text-sm text-gray-500 mt-1">Statistiques de la plateforme TheResto</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Restaurants actifs"
              value={stats?.totalRestaurants ?? 0}
              icon={Store}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="En attente d'approbation"
              value={stats?.pendingApprovals ?? 0}
              icon={Clock}
              color="bg-orange-50 text-orange-500"
              urgent={(stats?.pendingApprovals ?? 0) > 0}
              sublabel={(stats?.pendingApprovals ?? 0) > 0 ? 'Cliquez pour traiter' : undefined}
            />
            <StatCard
              label="Abonnements premium"
              value={stats?.premiumCount ?? 0}
              icon={Star}
              color="bg-purple-50 text-purple-600"
              sublabel={
                stats
                  ? `${Math.round(((stats.premiumCount ?? 0) / Math.max(stats.totalRestaurants ?? 1, 1)) * 100)}% du total`
                  : undefined
              }
            />
            <StatCard
              label="Revenus du mois"
              value={stats ? `${(stats.platformRevenueMTD ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` : '—'}
              icon={TrendingUp}
              color="bg-green-50 text-green-600"
              sublabel="Commissions plateforme"
            />
          </>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Activité récente</h3>
            <button
              onClick={() => router.push('/monitoring')}
              className="flex items-center gap-1 text-xs text-[#FF6B35] hover:text-[#e55e2a] font-medium transition-colors"
            >
              Tout voir <ArrowRight size={12} />
            </button>
          </div>

          {logsLoading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-5 py-3.5 animate-pulse">
                  <div className="w-4 h-4 rounded-full bg-gray-100 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3.5 w-40 bg-gray-100 rounded mb-1.5" />
                    <div className="h-3 w-24 bg-gray-50 rounded" />
                  </div>
                  <div className="h-3 w-16 bg-gray-50 rounded mt-0.5" />
                </div>
              ))}
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Activity size={28} className="mb-2 opacity-40" />
              <p className="text-sm">Aucune activité récente</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex gap-3 px-5 py-3.5">
                  <ActivityIcon success={log.success} action={log.action} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium">
                      {actionLabels[log.action] ?? log.action}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {log.adminEmail ?? log.adminId}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                    {formatTimestamp(log.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Actions rapides</h3>
          </div>
          <div className="p-3 space-y-1">
            {[
              {
                label: 'Approuver des restaurants',
                sublabel: `${stats?.pendingApprovals ?? 0} en attente`,
                href: '/restaurants?status=pending',
                urgent: (stats?.pendingApprovals ?? 0) > 0,
              },
              {
                label: 'Gérer les utilisateurs',
                sublabel: 'Droits et rôles',
                href: '/users',
                urgent: false,
              },
              {
                label: 'Voir les logs d\'audit',
                sublabel: 'Traçabilité des actions',
                href: '/monitoring',
                urgent: false,
              },
              {
                label: 'Configuration plateforme',
                sublabel: 'Commissions, paramètres',
                href: '/config',
                urgent: false,
              },
            ].map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.urgent && <AlertCircle size={14} className="text-orange-500 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${item.urgent ? 'text-orange-700' : 'text-gray-700'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-400">{item.sublabel}</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
