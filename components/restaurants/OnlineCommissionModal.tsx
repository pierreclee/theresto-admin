'use client';

import { CommissionRatesModal } from '@/components/config/CommissionRatesModal';
import { useSetRestaurantOnlineRate } from '@/lib/hooks/useCommissionSettings';
import { formatPercent } from '@/lib/utils/commissionRates';
import { normalizeSubscriptionPlan } from '@/lib/utils/subscriptionPlan';
import type { RestaurantOnlineRate } from '@/lib/types/commissions';

/** Plan dont le restaurant suit le taux (Essentiel et sans plan → Croissance, comme en base). */
function ratePlanLabel(plan: string | null): string {
  const key = normalizeSubscriptionPlan(plan);
  return key === 'liberte' || key === 'premium' ? 'Liberté' : 'Croissance';
}

/** « 5 % (taux du plan Croissance) » ou « 7,25 % (taux particulier) ». */
export function onlineRateLabel(rate: RestaurantOnlineRate, plan: string | null): string {
  const origin = rate.custom === null ? `taux du plan ${ratePlanLabel(plan)}` : 'taux particulier';
  return `${formatPercent(rate.effective)} (${origin})`;
}

/** Taux particulier des paiements en ligne d'un restaurant, ou retour au taux du plan (code 2FA). */
export function OnlineCommissionModal({
  restaurantId,
  mode,
  onlineRate,
  onClose,
}: {
  restaurantId: string;
  mode: 'edit' | 'reset';
  onlineRate: RestaurantOnlineRate;
  onClose: () => void;
}) {
  const { mutateAsync } = useSetRestaurantOnlineRate(restaurantId);

  if (mode === 'reset') {
    return (
      <CommissionRatesModal
        title="Retour au taux du plan"
        fields={[]}
        warning={`Le restaurant suivra de nouveau le taux de son plan (${formatPercent(onlineRate.planRate)}) pour les prochains paiements.`}
        confirmLabel="Revenir au taux du plan"
        onConfirm={async (_values, totpCode) => {
          await mutateAsync({ rate: null, expectedUpdatedAt: onlineRate.updatedAt, totpCode });
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <CommissionRatesModal
      title="Taux particulier du restaurant"
      fields={[{ key: 'rate', label: 'Taux particulier', initial: onlineRate.effective, kind: 'percent' }]}
      warning="S'applique aux paiements créés à partir de maintenant. Ce taux ne suivra plus les changements du taux du plan."
      confirmLabel="Enregistrer le taux particulier"
      unchangedConfirmation={
        onlineRate.custom === null
          ? {
              notice: 'Le taux actuel du plan sera figé pour ce restaurant : il ne suivra plus les changements du taux du plan.',
              confirmLabel: 'Figer ce taux',
            }
          : undefined
      }
      onConfirm={async (values, totpCode) => {
        await mutateAsync({ rate: values.rate, expectedUpdatedAt: onlineRate.updatedAt, totpCode });
      }}
      onClose={onClose}
    />
  );
}
