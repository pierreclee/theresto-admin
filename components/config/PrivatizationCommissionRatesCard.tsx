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
      description="Facturée chaque mois sur ce que le restaurant conserve des paiements de privatisation (carte ou virement, remboursements déduits), pour les restaurants sans taux particulier."
      modalTitle="Taux des privatisations"
      warning="S'applique aux privatisations dont le premier paiement est encaissé à partir de maintenant, pour tous les restaurants sans taux particulier. Les privatisations déjà payées gardent leur taux."
      zeroPercentWarning={PRIVATIZATION_ZERO_PERCENT_WARNING}
      rates={data?.privatizationRates}
      isPending={isPending}
      error={error}
      onSave={mutateAsync}
    />
  );
}
