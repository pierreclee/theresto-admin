'use client';

import { CommissionRatesModal } from '@/components/config/CommissionRatesModal';
import { formatPercent } from '@/lib/utils/commissionRates';
import { normalizeSubscriptionPlan } from '@/lib/utils/subscriptionPlan';
import type { RestaurantPlanRate } from '@/lib/types/commissions';

/** Plan dont le restaurant suit le taux (Essentiel et sans plan → Croissance, comme en base). */
function ratePlanLabel(plan: string | null): string {
  const key = normalizeSubscriptionPlan(plan);
  return key === 'liberte' || key === 'premium' ? 'Liberté' : 'Croissance';
}

/** « 5 % (taux du plan Croissance) » ou « 7,25 % (taux particulier) ». */
export function planRateLabel(rate: RestaurantPlanRate, plan: string | null): string {
  const origin = rate.custom === null ? `taux du plan ${ratePlanLabel(plan)}` : 'taux particulier';
  return `${formatPercent(rate.effective)} (${origin})`;
}

/**
 * Taux particulier d'une commission en pourcentage pour un restaurant, ou
 * retour au taux du plan (code 2FA). [paymentsLabel] désigne les paiements
 * concernés dans les textes (« paiements », « paiements de privatisation »).
 */
export function PlanRateModal({
  mode,
  rate,
  paymentsLabel,
  editWarning,
  resetWarning,
  zeroPercentWarning,
  onSave,
  onClose,
}: {
  mode: 'edit' | 'reset';
  rate: RestaurantPlanRate;
  paymentsLabel: string;
  /** Remplacent les textes construits avec [paymentsLabel]. */
  editWarning?: string;
  resetWarning?: string;
  zeroPercentWarning?: string;
  onSave: (input: { rate: number | null; expectedUpdatedAt: string | null; totpCode: string }) => Promise<unknown>;
  onClose: () => void;
}) {
  if (mode === 'reset') {
    return (
      <CommissionRatesModal
        title="Retour au taux du plan"
        fields={[]}
        warning={resetWarning ?? `Le restaurant suivra de nouveau le taux de son plan (${formatPercent(rate.planRate)}) pour les prochains ${paymentsLabel}.`}
        confirmLabel="Revenir au taux du plan"
        onConfirm={async (_values, totpCode) => {
          await onSave({ rate: null, expectedUpdatedAt: rate.updatedAt, totpCode });
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <CommissionRatesModal
      title="Taux particulier du restaurant"
      fields={[{ key: 'rate', label: 'Taux particulier', initial: rate.effective, kind: 'percent' }]}
      warning={editWarning ?? `S'applique aux ${paymentsLabel} créés à partir de maintenant. Ce taux ne suivra plus les changements du taux du plan.`}
      zeroPercentWarning={zeroPercentWarning}
      confirmLabel="Enregistrer le taux particulier"
      unchangedConfirmation={
        rate.custom === null
          ? {
              notice: 'Le taux actuel du plan sera figé pour ce restaurant : il ne suivra plus les changements du taux du plan.',
              confirmLabel: 'Figer ce taux',
            }
          : undefined
      }
      onConfirm={async (values, totpCode) => {
        await onSave({ rate: values.rate, expectedUpdatedAt: rate.updatedAt, totpCode });
      }}
      onClose={onClose}
    />
  );
}
