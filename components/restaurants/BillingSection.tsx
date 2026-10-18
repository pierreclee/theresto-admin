// components/restaurants/BillingSection.tsx
'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useRevenueSummary, useStripeOverview } from '@/lib/hooks/useBilling';
import {
  REVENUE_CATEGORY_LABELS,
  REVENUE_CATEGORY_ORDER,
  SUBSCRIPTION_STATUS_LABELS,
  billingDrift,
  centsToEuro,
  formatDateFr,
  paymentMethodLabel,
  safeStripeDashboardUrl,
  type DriftField,
} from '@/lib/utils/billing';
import type { RevenueCategorySummary, RevenueSummary, StripeOverview } from '@/lib/types/billing';

/** Fiche restaurant : revenus TheResto (registre) et état Stripe en direct. */
export function BillingSection({ restaurantId }: { restaurantId: string }) {
  const revenue = useRevenueSummary(restaurantId);
  const overview = useStripeOverview(restaurantId);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturation TheResto</h3>
      </div>
      <div className="p-5 space-y-5">
        {revenue.data ? (
          <RevenueBlock summary={revenue.data} />
        ) : revenue.error ? (
          <ErrorBox message={revenue.error.message} />
        ) : (
          <Skeleton />
        )}

        <div className="border-t border-gray-50 pt-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Stripe en direct</p>
          {overview.data ? (
            <StripeBlock overview={overview.data} />
          ) : overview.error ? (
            <ErrorBox message={overview.error.message} />
          ) : (
            <Skeleton />
          )}
        </div>
      </div>
    </div>
  );
}

function LastInvoiceTile({ label, entry, testId }: { label: string; entry: RevenueCategorySummary; testId: string }) {
  return (
    <div data-testid={testId} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      {entry.last ? (
        <>
          <p className="text-lg font-bold text-gray-900">{centsToEuro(entry.last.amount_cents)}</p>
          <p className="text-xs text-gray-400">le {formatDateFr(entry.last.occurred_at)}</p>
        </>
      ) : (
        <p className="text-lg font-bold text-gray-300">—</p>
      )}
    </div>
  );
}

function RevenueBlock({ summary }: { summary: RevenueSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LastInvoiceTile label="Dernière facture abonnement" entry={summary.categories.subscription} testId="last-subscription" />
        <LastInvoiceTile label="Dernière facture commissions" entry={summary.categories.booking_commission} testId="last-commission" />
        <div data-testid="total-paid" className="bg-orange-50 rounded-xl p-3.5 border border-orange-100">
          <p className="text-xs text-gray-500 mb-1.5">Total payé à TheResto</p>
          <p className="text-lg font-bold text-gray-900">{centsToEuro(summary.total_net_cents)}</p>
        </div>
      </div>
      <dl data-testid="revenue-breakdown" className="text-sm divide-y divide-gray-50">
        {REVENUE_CATEGORY_ORDER.map((category) => (
          <div key={category} className="flex justify-between py-1.5">
            <dt className="text-gray-500">{REVENUE_CATEGORY_LABELS[category]}</dt>
            <dd className="font-medium text-gray-900">{centsToEuro(summary.categories[category].net_cents)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DriftBadge({
  field,
  drift,
  databaseValue,
}: {
  field: DriftField;
  drift: Set<DriftField>;
  databaseValue?: string;
}) {
  if (!drift.has(field)) return null;
  return (
    <span
      title={databaseValue !== undefined ? `La base indique : ${databaseValue}` : 'La base ne suit pas Stripe sur ce champ'}
      className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-amber-50 text-amber-700 border border-amber-200"
    >
      Écart
      {databaseValue !== undefined && <span className="sr-only"> : la base indique {databaseValue}</span>}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{children}</span>
    </div>
  );
}

function StripeBlock({ overview }: { overview: StripeOverview }) {
  const { customer, subscription, upcomingInvoice } = overview;
  const url = safeStripeDashboardUrl(overview.dashboardUrl);
  const drift = billingDrift(overview);
  const dbStatus = overview.database.status;
  const dbStatusLabel = dbStatus ? (SUBSCRIPTION_STATUS_LABELS[dbStatus] ?? dbStatus) : '—';
  if (!customer) {
    return (
      <p className="text-sm text-gray-500">
        Aucun client Stripe
        <DriftBadge field="status" drift={drift} databaseValue={dbStatusLabel} />
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-gray-50">
        {subscription ? (
          <>
            <Row label="Statut">
              {SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status}
              <DriftBadge field="status" drift={drift} databaseValue={dbStatusLabel} />
            </Row>
            <Row label="Plan">
              {subscription.productName ?? subscription.priceId ?? '—'}
              <DriftBadge field="priceId" drift={drift} databaseValue={overview.database.priceId ?? '—'} />
            </Row>
            <Row label="Fin de période">
              {formatDateFr(subscription.currentPeriodEnd)}
              <DriftBadge field="periodEnd" drift={drift} databaseValue={formatDateFr(overview.database.periodEnd)} />
            </Row>
            <Row label="Résiliation programmée">
              {subscription.cancelAtPeriodEnd ? 'Oui' : 'Non'}
              <DriftBadge
                field="cancelAtPeriodEnd"
                drift={drift}
                databaseValue={overview.database.cancelAtPeriodEnd ? 'Oui' : 'Non'}
              />
            </Row>
          </>
        ) : (
          <Row label="Abonnement">
            Aucun
            <DriftBadge field="status" drift={drift} databaseValue={dbStatusLabel} />
          </Row>
        )}
        <Row label="Moyen de paiement">{paymentMethodLabel(customer.paymentMethod)}</Row>
        <Row label="E-mail de facturation">{customer.email ?? '—'}</Row>
        <Row label="Prochain prélèvement">
          {upcomingInvoice
            ? `${centsToEuro(upcomingInvoice.amountDueCents)} le ${formatDateFr(upcomingInvoice.date)}`
            : '—'}
        </Row>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 transition-colors"
        >
          <ExternalLink size={12} />
          Ouvrir dans Stripe
        </a>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
      <AlertTriangle size={15} className="shrink-0" />
      {message}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-56 bg-gray-100 rounded" />
      <div className="h-3 w-32 bg-gray-100 rounded" />
    </div>
  );
}
