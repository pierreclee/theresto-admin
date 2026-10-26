'use client';

import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { useResolveIncident } from '@/lib/hooks/usePrivatizationIncidents';
import { INCIDENT_KIND_LABELS, RESOLUTION_MAX_LENGTH, resolutionError } from '@/lib/utils/privatizationIncidents';
import type { PrivatizationIncident } from '@/lib/types/privatizationIncidents';

/** Marque un incident traité ou ignoré, avec une note obligatoire (sans 2FA : aucun argent ne bouge). */
export function IncidentResolveModal({
  incident,
  status,
  onClose,
}: {
  incident: PrivatizationIncident;
  status: 'resolved' | 'ignored';
  onClose: () => void;
}) {
  const { mutateAsync } = useResolveIncident();
  const noteId = useId();
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const title = status === 'ignored' ? "Ignorer l'incident" : "Marquer l'incident traité";

  const handleConfirm = async () => {
    const invalid = resolutionError(note);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setPending(true);
    try {
      await mutateAsync({ incidentId: incident.id, resolution: note.trim(), status });
      onClose();
    } catch (e) {
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
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
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
          <div>
            <label htmlFor={noteId} className="block text-xs font-medium text-gray-600 mb-1.5">
              {status === 'ignored' ? 'Pourquoi ignorer cet incident ?' : "Comment l'incident a-t-il été traité ?"}
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={RESOLUTION_MAX_LENGTH}
              rows={4}
              autoFocus
              placeholder="Ex. remboursé depuis le tableau de bord Stripe du restaurant le 25/10"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
            />
            <p className="text-xs text-gray-400 mt-1">Enregistrée dans le journal d&apos;audit.</p>
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
              disabled={pending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-colors disabled:opacity-40"
            >
              {pending ? 'En cours…' : status === 'ignored' ? 'Ignorer' : 'Marquer traité'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
