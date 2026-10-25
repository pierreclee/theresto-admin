'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/shared/Badge';
import { IncidentMoneyModal } from '@/components/incidents/IncidentMoneyModal';
import { IncidentResolveModal } from '@/components/incidents/IncidentResolveModal';
import { formatDateFr } from '@/lib/utils/billing';
import { formatEuro } from '@/lib/utils/commissionRates';
import {
  INCIDENT_KIND_HELP,
  INCIDENT_KIND_LABELS,
  INCIDENT_STATUS_LABELS,
  PRIVATIZATION_STATUS_LABELS,
  incidentDetailLines,
  moneyActionLabel,
} from '@/lib/utils/privatizationIncidents';
import type { IncidentMoneyAction, PrivatizationIncident } from '@/lib/types/privatizationIncidents';

type OpenModal =
  | { type: 'money'; incident: PrivatizationIncident; action: IncidentMoneyAction }
  | { type: 'resolve'; incident: PrivatizationIncident; status: 'resolved' | 'ignored' }
  | null;

const STATUS_VARIANT = { open: 'error', resolved: 'success', ignored: 'gray' } as const;

export function PrivatizationIncidentsTable({ incidents }: { incidents: PrivatizationIncident[] }) {
  const [modal, setModal] = useState<OpenModal>(null);

  if (incidents.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Aucun incident.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Incident</th>
              <th className="py-2 pr-4 font-medium">Restaurant</th>
              <th className="py-2 pr-4 font-medium">Privatisation</th>
              <th className="py-2 pr-4 font-medium text-right">Montant</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => {
              const priv = incident.privatization;
              const details = incidentDetailLines(incident);
              return (
                <tr key={incident.id} className="border-b border-gray-50 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-gray-600">{formatDateFr(incident.createdAt)}</td>
                  <td className="py-3 pr-4 max-w-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{INCIDENT_KIND_LABELS[incident.kind]}</span>
                      <Badge label={INCIDENT_STATUS_LABELS[incident.status]} variant={STATUS_VARIANT[incident.status]} size="sm" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{INCIDENT_KIND_HELP[incident.kind]}</p>
                    {details.length > 0 && (
                      <ul className="text-xs text-gray-400 mt-1.5 space-y-0.5">
                        {details.map((line) => (
                          <li key={line} className="break-all">{line}</li>
                        ))}
                      </ul>
                    )}
                    {incident.resolution && (
                      <p className="text-xs text-gray-600 mt-1.5">
                        Note : {incident.resolution}
                        {incident.resolvedAt ? ` (${formatDateFr(incident.resolvedAt)})` : ''}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {incident.restaurantId ? (
                      <Link href={`/restaurants/${incident.restaurantId}`} className="text-[#FF6B35] hover:underline">
                        {incident.restaurantName ?? 'Restaurant'}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {priv ? (
                      <div className="space-y-0.5">
                        <p>Événement : {formatDateFr(priv.date)}</p>
                        <p className="text-gray-900">{priv.organizerName ?? '—'}</p>
                        {priv.organizerEmail && (
                          <a href={`mailto:${priv.organizerEmail}`} className="text-xs text-[#FF6B35] hover:underline break-all">
                            {priv.organizerEmail}
                          </a>
                        )}
                        {priv.status && (
                          <p className="text-xs text-gray-400">{PRIVATIZATION_STATUS_LABELS[priv.status] ?? priv.status}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {incident.amount == null ? '—' : formatEuro(incident.amount)}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col gap-1.5 items-start">
                      {incident.actions.map((action) =>
                        action === 'resolve' ? null : (
                          <button
                            key={action}
                            onClick={() => setModal({ type: 'money', incident, action })}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-lg whitespace-nowrap"
                          >
                            {moneyActionLabel(incident.kind, action)}
                          </button>
                        ),
                      )}
                      {incident.actions.includes('resolve') && (
                        <>
                          <button
                            onClick={() => setModal({ type: 'resolve', incident, status: 'resolved' })}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg whitespace-nowrap"
                          >
                            Marquer traité
                          </button>
                          <button
                            onClick={() => setModal({ type: 'resolve', incident, status: 'ignored' })}
                            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Ignorer
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal?.type === 'money' && (
        <IncidentMoneyModal incident={modal.incident} action={modal.action} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'resolve' && (
        <IncidentResolveModal incident={modal.incident} status={modal.status} onClose={() => setModal(null)} />
      )}
    </>
  );
}
