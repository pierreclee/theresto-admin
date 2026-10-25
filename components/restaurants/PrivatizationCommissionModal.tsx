'use client';

import { PlanRateModal } from '@/components/restaurants/PlanRateModal';
import { useSetRestaurantPrivatizationRate } from '@/lib/hooks/useCommissionSettings';
import { PRIVATIZATION_ZERO_PERCENT_WARNING, formatPercent } from '@/lib/utils/commissionRates';
import type { RestaurantPlanRate } from '@/lib/types/commissions';

/** Taux particulier de la commission des privatisations d'un restaurant, ou retour au taux du plan (code 2FA). */
export function PrivatizationCommissionModal({
  restaurantId,
  mode,
  privatizationRate,
  onClose,
}: {
  restaurantId: string;
  mode: 'edit' | 'reset';
  privatizationRate: RestaurantPlanRate;
  onClose: () => void;
}) {
  const { mutateAsync } = useSetRestaurantPrivatizationRate(restaurantId);
  return (
    <PlanRateModal
      mode={mode}
      rate={privatizationRate}
      paymentsLabel="paiements de privatisation"
      editWarning="S'applique aux privatisations dont le premier paiement est encaissé à partir de maintenant (le taux est figé à ce moment-là). Ce taux ne suivra plus les changements du taux du plan."
      resetWarning={`Le restaurant suivra de nouveau le taux de son plan (${formatPercent(privatizationRate.planRate)}) pour ses prochaines privatisations.`}
      zeroPercentWarning={PRIVATIZATION_ZERO_PERCENT_WARNING}
      onSave={mutateAsync}
      onClose={onClose}
    />
  );
}
