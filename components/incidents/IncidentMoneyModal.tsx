'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { TotpCodeField } from '@/components/shared/TotpCodeField';
import { useIncidentMoneyAction } from '@/lib/hooks/usePrivatizationIncidents';
import { formatEuro } from '@/lib/utils/commissionRates';
import { INCIDENT_KIND_LABELS, moneyActionLabel } from '@/lib/utils/privatizationIncidents';
import type { IncidentMoneyAction, PrivatizationIncident } from '@/lib/types/privatizationIncidents';

const WARNINGS: Record<IncidentMoneyAction, string> = {
  retryRefund:
    "Le remboursement est fait sur le compte Stripe du restaurant qui a encaissé. Pour un virement, Stripe demande son IBAN au client par e-mail.",
  returnCustomerBalance:
    "Tout le solde client Stripe du restaurant est restitué au client : Stripe lui demande son IBAN par e-mail.",
};

/** Remboursement ou restitution d'un solde pour un incident (code 2FA exigé). */
export function IncidentMoneyModal({
  incident,
  action,
  onClose,
}: {
  incident: PrivatizationIncident;
  action: IncidentMoneyAction;
  onClose: () => void;
}) {
  const { mutateAsync } = useIncidentMoneyAction();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const label = moneyActionLabel(incident.kind, action);

  const handleConfirm = async () => {
    setError('');
    setPending(true);
    try {
      await mutateAsync({ incidentId: incident.id, action, totpCode: code });
      onClose();
    } catch (e) {
      setCode('');
      setError(e instanceof Error ? e.message : "L'action a échoué.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{INCIDENT_KIND_LABELS[incident.kind]}</p>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Fermer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <ul className="space-y-1.5 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-gray-500">Restaurant</span>
              <span className="font-medium text-gray-900">{incident.restaurantName ?? '—'}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-gray-500">Client</span>
              <span className="font-medium text-gray-900">
                {incident.privatization?.organizerEmail ?? incident.privatization?.organizerName ?? '—'}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-gray-500">{action === 'returnCustomerBalance' ? 'Solde connu' : 'Montant'}</span>
              <span className="font-semibold text-gray-900">
                {incident.amount == null ? 'calculé par le serveur' : formatEuro(incident.amount)}
              </span>
            </li>
          </ul>

          <TotpCodeField
            value={code}
            onChange={setCode}
            onSubmit={handleConfirm}
            busy={pending}
            hint="Requis pour tout remboursement, même si vous êtes déjà connecté."
          />

          <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <p>{WARNINGS[action]}</p>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={pending}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={code.length !== 6 || pending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl transition-colors disabled:opacity-40"
            >
              {pending ? 'En cours…' : label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
