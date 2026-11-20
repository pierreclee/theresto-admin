'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { OntimeActionModal } from '@/components/ontime/OntimeActionModal';
import { useOntimeSanctionsSwitch, useSetOntimeSanctions } from '@/lib/hooks/useOntime';
import { actionErrorMessage } from '@/lib/api/actionResult';
import { formatInstant } from '@/lib/utils/restaurantAlerts';

/**
 * Interrupteur des sanctions OnTime automatiques (platform_commission_settings,
 * ontime_sanctions_enabled ; Q11). Livré éteint : l'allumer exige une confirmation explicite que
 * les CGV 1.2 (article 7.4 bis) sont publiées, puis un code TOTP. Le retrait et la levée par
 * TheResto restent permis dans les deux positions.
 */
export function OntimeSanctionsCard() {
  const { data, isPending, error } = useOntimeSanctionsSwitch();
  const setSwitch = useSetOntimeSanctions();
  // Valeur visée et version lue, figées à l'ouverture : après un conflit, l'état rechargé ne
  // retourne pas l'action et n'envoie pas en silence une version que l'admin n'a pas vue.
  const [target, setTarget] = useState<{ enabled: boolean; expectedUpdatedAt: string | null } | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Sanctions OnTime automatiques</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Avertissement au 2e manquement, suspension de 14 jours au 3e au-delà de 10 % des OnTime servies sur 30 jours
          (CGV 7.4 bis). Éteintes, signalements, contestations et compteurs fonctionnent, sans sanction automatique.
        </p>
      </div>

      {error ? (
        <div className="m-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          {actionErrorMessage(error, 'Impossible de lire l’interrupteur.')}
        </div>
      ) : isPending || !data ? (
        <div className="p-5 animate-pulse"><div className="h-14 bg-gray-100 rounded-xl" /></div>
      ) : (
        <div className="m-5 flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
          <div className="min-w-0">
            <p className="text-xs" data-testid="ontime-switch-state">
              <span className={`font-semibold ${data.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                {data.enabled ? 'Allumées' : 'Éteintes'}
              </span>
              {data.updatedAt && <span className="text-gray-400"> depuis le {formatInstant(data.updatedAt)}</span>}
            </p>
            {data.enabledAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                Dernier allumage : {formatInstant(data.enabledAt)}.
                {data.enabled && ' Aucun manquement antérieur ne compte pour une sanction.'}
              </p>
            )}
          </div>
          <button
            onClick={() => setTarget({ enabled: !data.enabled, expectedUpdatedAt: data.updatedAt })}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 bg-white rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 transition-colors flex-shrink-0"
          >
            {data.enabled ? 'Éteindre' : 'Allumer'}
          </button>
        </div>
      )}

      {target !== null && (
        <OntimeActionModal
          title={target.enabled ? 'Allumer les sanctions OnTime' : 'Éteindre les sanctions OnTime'}
          warning={
            target.enabled
              ? 'Les CGV 1.2 (article 7.4 bis) doivent être publiées et en vigueur avant d’allumer. Seuls les manquements retenus après l’allumage compteront ; aucune sanction rétroactive.'
              : 'Plus aucun avertissement ni aucune suspension automatique. Les sanctions en cours ne sont pas levées (levée par restaurant, dans sa fiche).'
          }
          confirmation={target.enabled ? 'Je confirme que les CGV 1.2 (article 7.4 bis) sont publiées et en vigueur.' : undefined}
          confirmLabel={target.enabled ? 'Allumer' : 'Éteindre'}
          danger={target.enabled}
          onConfirm={async (_reason, totpCode) => {
            await setSwitch.mutateAsync({
              enabled: target.enabled,
              expectedUpdatedAt: target.expectedUpdatedAt,
              confirmCgv: target.enabled,
              totpCode,
            });
          }}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
