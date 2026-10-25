'use client';

import { PlanRateModal } from '@/components/restaurants/PlanRateModal';
import { useSetRestaurantPrivatizationRate } from '@/lib/hooks/useCommissionSettings';
import { PRIVATIZATION_ZERO_PERCENT_WARNING } from '@/lib/utils/commissionRates';
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
      zeroPercentWarning={PRIVATIZATION_ZERO_PERCENT_WARNING}
      onSave={mutateAsync}
      onClose={onClose}
    />
  );
}
