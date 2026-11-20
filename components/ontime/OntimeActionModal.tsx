'use client';

import { useId, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { TotpCodeField } from '@/components/shared/TotpCodeField';
import { REASON_HINT, REASON_MAX_LENGTH, reasonError } from '@/lib/utils/ontime';

/**
 * Action OnTime de TheResto : motif (10 à 1 000 caractères, montré au restaurant), case de
 * confirmation explicite si demandée, puis code TOTP (vérifié il y a moins de 5 minutes côté
 * serveur). [onConfirm] lève une Error au message déjà en français ; les toasts de succès
 * sont faits par les hooks de mutation.
 */
export function OntimeActionModal({
  title,
  subtitle,
  children,
  reasonLabel,
  reasonPlaceholder,
  warning,
  confirmation,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Sans libellé : pas de motif (interrupteur). */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  warning?: string;
  /** Case à cocher obligatoire avant de confirmer. */
  confirmation?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string, totpCode: string) => Promise<void>;
  onClose: () => void;
}) {
  const reasonId = useId();
  const checkId = useId();
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    if (pending) return;
    if (reasonLabel) {
      const invalid = reasonError(reason);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    if (confirmation && !checked) {
      setError('Cochez la case de confirmation.');
      return;
    }
    if (code.length !== 6) {
      setError('Saisissez le code à 6 chiffres de votre application d’authentification.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await onConfirm(reason.trim(), code);
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
        aria-label={title}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
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
          {children}

          {reasonLabel && (
            <div>
              <label htmlFor={reasonId} className="block text-xs font-medium text-gray-600 mb-1.5">
                {reasonLabel}
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={REASON_MAX_LENGTH}
                rows={4}
                autoFocus
                placeholder={reasonPlaceholder}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
              />
              <p className="text-xs text-gray-400 mt-1 flex justify-between gap-3">
                <span>{REASON_HINT}</span>
                <span className="tabular-nums flex-shrink-0">{reason.trim().length} / {REASON_MAX_LENGTH}</span>
              </p>
            </div>
          )}

          {warning && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <p>{warning}</p>
            </div>
          )}

          {confirmation && (
            <label htmlFor={checkId} className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input
                id={checkId}
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 accent-[#FF6B35]"
              />
              <span>{confirmation}</span>
            </label>
          )}

          <TotpCodeField
            value={code}
            onChange={setCode}
            onSubmit={handleConfirm}
            busy={pending}
            autoFocus={!reasonLabel}
            hint="Requis pour toute décision OnTime, même si vous êtes déjà connecté."
          />

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
              disabled={pending || code.length !== 6 || (!!confirmation && !checked)}
              className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-40 ${
                danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-900'
              }`}
            >
              {pending ? 'En cours…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
