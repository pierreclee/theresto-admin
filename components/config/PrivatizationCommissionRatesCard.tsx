'use client';

import { PlanCommissionRatesCard } from '@/components/config/PlanCommissionRatesCard';
import { useCommissionSettings, useUpdateGlobalPrivatizationRates } from '@/lib/hooks/useCommissionSettings';
import { PRIVATIZATION_ZERO_PERCENT_WARNING } from '@/lib/utils/commissionRates';

/** Taux globaux de commission des privatisations, par plan. */
export function PrivatizationCommissionRatesCard() {
  const { data, isPending, error } = useCommissionSettings();
  const { mutateAsync } = useUpdateGlobalPrivatizationRates();

  return (
    <PlanCommissionRatesCard
      title="Commission privatisations"
      description="Prélevée sur les paiements de privatisation créés à partir de maintenant (carte, et commission notée lors d'un virement), pour les restaurants sans taux particulier."
      modalTitle="Taux des privatisations"
      warning="S'applique aux paiements de privatisation créés à partir de maintenant, pour tous les restaurants sans taux particulier. Les paiements déjà créés gardent leur commission."
      zeroPercentWarning={PRIVATIZATION_ZERO_PERCENT_WARNING}
      rates={data?.privatizationRates}
      isPending={isPending}
      error={error}
      onSave={mutateAsync}
    />
  );
}
