'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { Table } from '@/components/shared/Table';
import { AuditLog } from '@/lib/types/audit';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_RESOURCE_LABELS,
  AUDIT_RESOURCE_OPTIONS,
  formatAuditDetails,
} from '@/lib/utils/auditLog';

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
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const { data, isPending } = useAuditLogs({
    limit: LIMIT,
    offset,
    // Jours « AAAA-MM-JJ » des champs date, lus comme des jours de Paris par le serveur.
    startDate: startInput || undefined,
    endDate: endInput || undefined,
    action: actionFilter || undefined,
    resourceType: resourceFilter || undefined,
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
        <select
          aria-label="Action"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); resetOffset(); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
        >
          <option value="">Toutes les actions</option>
          {AUDIT_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          aria-label="Type"
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); resetOffset(); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
        >
          <option value="">Tous les types</option>
          {AUDIT_RESOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(startInput || endInput || actionFilter || resourceFilter) && (
          <button
            onClick={() => {
              setStartInput(''); setEndInput(''); setActionFilter(''); setResourceFilter(''); resetOffset();
            }}
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
            render: (v) => AUDIT_ACTION_LABELS[String(v)] ?? String(v),
          },
          {
            key: 'resourceType',
            label: 'Type',
            render: (v) => AUDIT_RESOURCE_LABELS[String(v)] ?? String(v),
          },
          {
            key: 'changes',
            label: 'Détails',
            // Liste blanche, sans texte libre (RGPD-29, D3).
            render: (v) => (
              <span className="text-xs text-gray-500">
                {formatAuditDetails(v as Record<string, unknown> | undefined) || '—'}
              </span>
            ),
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
