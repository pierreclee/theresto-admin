'use client';

import { PlanCommissionRatesCard } from '@/components/config/PlanCommissionRatesCard';
import { useCommissionSettings, useUpdateGlobalOnlineRates } from '@/lib/hooks/useCommissionSettings';

/** Taux globaux de commission des paiements en ligne (Stripe Connect), par plan. */
export function OnlineCommissionRatesCard() {
  const { data, isPending, error } = useCommissionSettings();
  const { mutateAsync } = useUpdateGlobalOnlineRates();

  return (
    <PlanCommissionRatesCard
      title="Commission paiements en ligne"
      description="Prélevée sur chaque paiement en ligne (Stripe Connect), pour les restaurants sans taux particulier."
      modalTitle="Taux des paiements en ligne"
      warning="S'applique aux paiements créés à partir de maintenant, pour tous les restaurants sans taux particulier. Les paiements déjà créés gardent leur commission."
      rates={data?.onlineRates}
      isPending={isPending}
      error={error}
      onSave={mutateAsync}
    />
  );
}
