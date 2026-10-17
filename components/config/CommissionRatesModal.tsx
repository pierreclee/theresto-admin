'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { TotpCodeField } from '@/components/shared/TotpCodeField';
import { formatEuro, parseEuroInput, parseMonthsInput } from '@/lib/utils/commissionRates';

export interface CommissionRateField {
  key: string;
  label: string;
  initial: number;
  kind: 'euro' | 'months';
  /** Maximum pour un montant (défaut 100 €). */
  max?: number;
}

function formatFieldValue(field: CommissionRateField, value: number): string {
  return field.kind === 'euro' ? `${formatEuro(value)} HT` : `${value} mois`;
}

/**
 * Modification de tarifs de commission en deux étapes : saisie, puis code 2FA.
 * Sans champ ([fields] vide), seule l'étape de confirmation est affichée.
 * [onConfirm] lève une Error dont le message (déjà en français) est affiché ;
 * les toasts de succès sont gérés par les hooks de mutation.
 */
export function CommissionRatesModal({
  title,
  fields,
  warning,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  fields: CommissionRateField[];
  warning: string;
  confirmLabel: string;
  onConfirm: (values: Record<string, number>, totpCode: string) => Promise<void>;
  onClose: () => void;
}) {
  const hasForm = fields.length > 0;
  const [step, setStep] = useState<'form' | 'confirm'>(hasForm ? 'form' : 'confirm');
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initial.toString().replace('.', ',')])),
  );
  const [values, setValues] = useState<Record<string, number>>({});
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const goToConfirm = () => {
    const parsed: Record<string, number> = {};
    for (const field of fields) {
      const raw = drafts[field.key] ?? '';
      const value = field.kind === 'euro' ? parseEuroInput(raw, field.max) : parseMonthsInput(raw);
      if (value === null) {
        setError(
          field.kind === 'euro'
            ? `${field.label} : montant invalide (entre 0 et ${field.max ?? 100} €, 2 décimales maximum)`
            : `${field.label} : nombre de mois invalide (entier entre 0 et 12)`,
        );
        return;
      }
      parsed[field.key] = value;
    }
    if (fields.every((f) => parsed[f.key] === f.initial)) {
      setError('Aucune valeur modifiée');
      return;
    }
    setError('');
    setValues(parsed);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setError('');
    setPending(true);
    try {
      await onConfirm(values, code);
      onClose();
    } catch (e) {
      setCode('');
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour du tarif');
    } finally {
      setPending(false);
    }
  };

  const changedFields = fields.filter((f) => values[f.key] !== undefined && values[f.key] !== f.initial);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {hasForm && <p className="text-xs text-gray-400 mt-0.5">Étape {step === 'form' ? '1' : '2'} sur 2</p>}
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Fermer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'form' ? (
            fields.map((field, index) => (
              <div key={field.key}>
                <label htmlFor={`rate-${field.key}`} className="block text-xs font-medium text-gray-600 mb-1.5">
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    id={`rate-${field.key}`}
                    type="text"
                    inputMode={field.kind === 'euro' ? 'decimal' : 'numeric'}
                    value={drafts[field.key] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [field.key]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && goToConfirm()}
                    autoFocus={index === 0}
                    className="w-full text-base font-semibold border border-gray-200 rounded-xl px-4 py-2 pr-14 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {field.kind === 'euro' ? '€ HT' : 'mois'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <>
              {changedFields.length > 0 && (
                <ul className="space-y-1.5 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100">
                  {changedFields.map((field) => (
                    <li key={field.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-500">{field.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-gray-400 line-through">{formatFieldValue(field, field.initial)}</span>
                        <ArrowRight size={13} className="text-gray-400" />
                        <span className="font-semibold text-gray-900">{formatFieldValue(field, values[field.key])}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <TotpCodeField value={code} onChange={setCode} onSubmit={handleConfirm} disabled={pending} />
            </>
          )}

          <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <p>{warning}</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={
                step === 'confirm' && hasForm
                  ? () => {
                      setError('');
                      setCode('');
                      setStep('form');
                    }
                  : onClose
              }
              disabled={pending}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              {step === 'confirm' && hasForm ? 'Retour' : 'Annuler'}
            </button>
            {step === 'form' ? (
              <button
                onClick={goToConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors"
              >
                Continuer
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={code.length !== 6 || pending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl transition-colors disabled:opacity-40"
              >
                {pending ? 'Mise à jour…' : confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
