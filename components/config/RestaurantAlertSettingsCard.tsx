'use client';

import { useState } from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import { useAlertSettings, useUpdateAlertSettings } from '@/lib/hooks/useRestaurantAlerts';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { formatInstant, formatRate, parseMinCount, parseRatePercent, rateToPercent } from '@/lib/utils/restaurantAlerts';

/**
 * Seuils d'alerte des demandes non confirmées : N (nombre) et X (taux, saisi en %).
 * Écriture conditionnée à la version lue (conflit → valeurs rechargées, à revérifier).
 */
export function RestaurantAlertSettingsCard() {
  const { data, isPending, error } = useAlertSettings();
  const { mutateAsync, isPending: saving } = useUpdateAlertSettings();
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState('');
  const [rate, setRate] = useState('');
  const [formError, setFormError] = useState('');

  const startEdit = () => {
    if (!data) return;
    setCount(String(data.minCount));
    setRate(String(rateToPercent(data.minRate)).replace('.', ','));
    setFormError('');
    setEditing(true);
  };

  const save = async () => {
    if (!data) return;
    const minCount = parseMinCount(count);
    if (minCount === null) return setFormError('Nombre de demandes : entier entre 1 et 1000.');
    const minRatePercent = parseRatePercent(rate);
    if (minRatePercent === null) return setFormError('Taux : entre 0 et 100 %, 2 décimales au plus.');
    setFormError('');
    try {
      await mutateAsync({ values: { minCount, minRatePercent }, expectedUpdatedAt: data.updatedAt });
      setEditing(false);
    } catch (e) {
      // Conflit : les valeurs ont été rechargées (onSettled) ; l'admin repart d'elles.
      setFormError(actionErrorMessage(e, 'Modification des seuils impossible. Réessayez.'));
      if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'conflict') setEditing(false);
    }
  };

  return (
    <section aria-labelledby="alert-settings-title" className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
        <div>
          <h3 id="alert-settings-title" className="text-sm font-semibold text-gray-900">Seuils d&apos;alerte</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Un restaurant est en alerte quand il laisse sans réponse, jusqu&apos;à la fin du service, au moins N demandes
            et au moins X % des demandes reçues par l&apos;App et le widget sur 30 jours.
          </p>
        </div>
        {data && !error && !editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 transition-colors flex-shrink-0"
          >
            <Pencil size={12} />
            Modifier
          </button>
        )}
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {actionErrorMessage(error, 'Impossible de charger les seuils d’alerte.')}
        </div>
      ) : isPending || !data ? (
        <div className="p-5 grid grid-cols-2 gap-3 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="alert-min-count" className="block text-xs font-medium text-gray-600 mb-1.5">
                  N : demandes non confirmées
                </label>
                <input
                  id="alert-min-count"
                  type="text"
                  inputMode="numeric"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="w-full text-base font-semibold border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
                />
              </div>
              <div>
                <label htmlFor="alert-min-rate" className="block text-xs font-medium text-gray-600 mb-1.5">
                  X : taux minimal (%)
                </label>
                <input
                  id="alert-min-rate"
                  type="text"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !saving && save()}
                  className="w-full text-base font-semibold border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20"
                />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <dt className="text-xs text-gray-500">N : demandes non confirmées</dt>
                <dd className="text-sm font-semibold text-gray-900 mt-0.5">{data.minCount}</dd>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <dt className="text-xs text-gray-500">X : taux minimal</dt>
                <dd className="text-sm font-semibold text-gray-900 mt-0.5">{formatRate(data.minRate)}</dd>
              </div>
            </dl>
          )}

          {formError && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
          )}

          {editing && (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setFormError(''); }}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e85d2a] rounded-xl transition-colors disabled:opacity-40"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Suivi depuis le {formatInstant(data.trackingSince, false)}.{' '}
            Dernière modification le {formatInstant(data.updatedAt)}
            {data.updatedBy ? ` par ${data.updatedBy}` : ''}.
          </p>
        </div>
      )}
    </section>
  );
}
