'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { Table } from '@/components/shared/Table';
import { AuditLog } from '@/lib/types/audit';

// Actions écrites dans platform_logs (RGPD-29) : Server Actions de theresto-admin et Edge
// Functions admin (admin-onboarding, commission-settings, subscription-prices,
// admin-privatization-incidents, migration-tools, cron-invoice-commissions).
const actionLabels: Record<string, string> = {
  list_users: 'Liste des utilisateurs consultée',
  view_user: 'Utilisateur consulté',
  view_user_profile: 'Fiche utilisateur consultée',
  moderate_user: 'Utilisateur modéré',
  list_restaurants: 'Liste des restaurants consultée',
  view_restaurant: 'Restaurant consulté',
  view_kbis: 'Kbis consulté',
  update_restaurant: 'Restaurant modifié',
  suspend_restaurant: 'Restaurant suspendu',
  approve_restaurant: 'Restaurant approuvé',
  reject_restaurant: 'Restaurant refusé',
  create_restaurant_invitation: 'Invitation envoyée',
  subscription_plan_changed: 'Formule modifiée',
  update_platform_config: 'Configuration modifiée',
  update_subscription_price: 'Prix d’abonnement modifié',
  update_global_commission_rates: 'Commissions globales modifiées',
  update_restaurant_commission_rates: 'Commissions du restaurant modifiées',
  reset_restaurant_commission_rates: 'Commissions du restaurant réinitialisées',
  update_global_online_commission_rates: 'Taux en ligne globaux modifiés',
  update_restaurant_online_commission_rate: 'Taux en ligne du restaurant modifié',
  reset_restaurant_online_commission_rate: 'Taux en ligne du restaurant réinitialisé',
  update_global_privatization_commission_rates: 'Taux de privatisation globaux modifiés',
  update_restaurant_privatization_commission_rate: 'Taux de privatisation du restaurant modifié',
  reset_restaurant_privatization_commission_rate: 'Taux de privatisation du restaurant réinitialisé',
  list_privatization_incidents: 'Incidents de privatisation consultés',
  retry_privatization_refund: 'Remboursement relancé',
  retry_privatization_refund_failed: 'Remboursement relancé (échec)',
  return_privatization_customer_balance: 'Solde client rendu',
  return_privatization_customer_balance_failed: 'Solde client rendu (échec)',
  resolve_privatization_incident: 'Incident traité',
  backfill_platform_revenue: 'Revenus de la plateforme recalculés',
  commission_invoice_failed: 'Facture de commissions en échec',
};

const resourceLabels: Record<string, string> = {
  user: 'Utilisateur',
  restaurant: 'Restaurant',
  kbis: 'Kbis',
  config: 'Configuration',
  onboarding_invitation: 'Invitation',
  commission_rates: 'Commissions',
  subscription_price: 'Prix',
  privatization_incident: 'Incident',
  commission_invoice: 'Facture',
  platform: 'Plateforme',
};

function parseDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
}

const LIMIT = 50;

export function AuditLogsViewer() {
  const [offset, setOffset] = useState(0);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const { data, isPending } = useAuditLogs({
    limit: LIMIT,
    offset,
    startDate: startInput ? new Date(startInput) : undefined,
    endDate: endInput ? new Date(endInput) : undefined,
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  const resetOffset = () => setOffset(0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <SlidersHorizontal size={15} className="text-gray-400 flex-shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Du</label>
          <input
            type="date"
            value={startInput}
            onChange={(e) => { setStartInput(e.target.value); resetOffset(); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">au</label>
          <input
            type="date"
            value={endInput}
            onChange={(e) => { setEndInput(e.target.value); resetOffset(); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          />
        </div>
        {(startInput || endInput) && (
          <button
            onClick={() => { setStartInput(''); setEndInput(''); resetOffset(); }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Réinitialiser
          </button>
        )}
        {data && (
          <span className="text-xs text-gray-400 ml-auto">
            {data.total} entrée{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <Table<AuditLog>
        columns={[
          {
            key: 'timestamp',
            label: 'Date',
            render: (v) => {
              const d = parseDate(v);
              return isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              });
            },
          },
          {
            key: 'adminEmail',
            label: 'Admin',
            render: (v) => (
              <span className="text-xs text-gray-500 font-mono truncate max-w-[180px] block">
                {String(v ?? '—')}
              </span>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            render: (v) => actionLabels[String(v)] ?? String(v),
          },
          {
            key: 'resourceType',
            label: 'Type',
            render: (v) => resourceLabels[String(v)] ?? String(v),
          },
          {
            key: 'success',
            label: 'Statut',
            render: (v) => (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                v
                  ? 'bg-green-50 text-green-700 border-green-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {v ? 'Succès' : 'Erreur'}
              </span>
            ),
          },
        ]}
        data={data?.logs ?? []}
        keyField="id"
        loading={isPending}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm text-gray-500">
            Page {currentPage} / {totalPages}
          </span>
          <button
            disabled={offset + LIMIT >= (data?.total ?? 0)}
            onClick={() => setOffset((o) => o + LIMIT)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
