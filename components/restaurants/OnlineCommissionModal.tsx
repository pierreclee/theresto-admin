'use client';

import { PlanRateModal } from '@/components/restaurants/PlanRateModal';
import { useSetRestaurantOnlineRate } from '@/lib/hooks/useCommissionSettings';
import type { RestaurantPlanRate } from '@/lib/types/commissions';

/** Taux particulier des paiements en ligne d'un restaurant, ou retour au taux du plan (code 2FA). */
export function OnlineCommissionModal({
  restaurantId,
  mode,
  onlineRate,
  onClose,
}: {
  restaurantId: string;
  mode: 'edit' | 'reset';
  onlineRate: RestaurantPlanRate;
  onClose: () => void;
}) {
  const { mutateAsync } = useSetRestaurantOnlineRate(restaurantId);
  return (
    <PlanRateModal mode={mode} rate={onlineRate} paymentsLabel="paiements" onSave={mutateAsync} onClose={onClose} />
  );
}
