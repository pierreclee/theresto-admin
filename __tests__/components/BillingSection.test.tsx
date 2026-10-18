// __tests__/components/BillingSection.test.tsx
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { BillingSection } from '@/components/restaurants/BillingSection';
import { formatEuro } from '@/lib/utils/commissionRates';
import type { RevenueSummary, StripeOverview } from '@/lib/types/billing';

// jest-dom normalise les espaces du texte rendu, pas ceux de l'attendu (NBSP de Intl).
const eur = (n: number) => formatEuro(n).replace(/\s/g, ' ');

const summary: RevenueSummary = {
  currency: 'eur',
  total_net_cents: 7390,
  categories: {
    subscription: { net_cents: 5800, last: { amount_cents: 2900, occurred_at: '2026-10-05T12:00:00Z' } },
    booking_commission: { net_cents: 1240, last: { amount_cents: 1240, occurred_at: '2026-10-01T12:00:00Z' } },
    application_fee: { net_cents: 350, last: { amount_cents: 150, occurred_at: '2026-10-10T12:00:00Z' } },
    monthly_fee: { net_cents: 0, last: null },
  },
};

const overview: StripeOverview = {
  customer: {
    id: 'cus_1',
    email: 'facturation@resto.fr',
    livemode: false,
    paymentMethod: { type: 'sepa_debit', brand: null, last4: '3000' },
  },
  subscription: {
    id: 'sub_1',
    status: 'active',
    priceId: 'price_1',
    productName: 'Croissance',
    currentPeriodEnd: '2026-11-01T12:00:00Z',
    cancelAtPeriodEnd: false,
  },
  upcomingInvoice: { amountDueCents: 2900, date: '2026-11-01T12:00:00Z' },
  database: { status: 'active', priceId: 'price_1', periodEnd: '2026-11-01T12:00:00Z', cancelAtPeriodEnd: false },
  dashboardUrl: 'https://dashboard.stripe.com/test/customers/cus_1',
};

let mockSummary: { data?: RevenueSummary; isPending: boolean; error: Error | null };
let mockOverview: { data?: StripeOverview; isPending: boolean; error: Error | null };

jest.mock('@/lib/hooks/useBilling', () => ({
  useRevenueSummary: () => mockSummary,
  useStripeOverview: () => mockOverview,
}));

describe('BillingSection', () => {
  beforeEach(() => {
    mockSummary = { data: summary, isPending: false, error: null };
    mockOverview = { data: overview, isPending: false, error: null };
  });

  it('affiche les dernières factures et le total avec son détail', () => {
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByTestId('last-subscription')).toHaveTextContent(eur(29));
    expect(screen.getByTestId('last-subscription')).toHaveTextContent('05/10/2026');
    expect(screen.getByTestId('last-commission')).toHaveTextContent(eur(12.4));
    expect(screen.getByTestId('total-paid')).toHaveTextContent(eur(73.9));

    const breakdown = screen.getByTestId('revenue-breakdown');
    expect(within(breakdown).getByText('Abonnement').parentElement).toHaveTextContent(eur(58));
    expect(within(breakdown).getByText('Frais sur paiements en ligne').parentElement).toHaveTextContent(eur(3.5));
    expect(within(breakdown).getByText('Frais mensuels SEPA (ancien)').parentElement).toHaveTextContent(eur(0));
  });

  it('dernière facture absente : tiret', () => {
    mockSummary = {
      data: { ...summary, categories: { ...summary.categories, booking_commission: { net_cents: 0, last: null } } },
      isPending: false,
      error: null,
    };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByTestId('last-commission')).toHaveTextContent('—');
  });

  it('état Stripe en direct, lien vers le client, aucun écart', () => {
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Croissance')).toBeInTheDocument();
    expect(screen.getByText('Prélèvement SEPA •••• 3000')).toBeInTheDocument();
    expect(screen.getByText('facturation@resto.fr')).toBeInTheDocument();
    expect(screen.queryByText('Écart')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ouvrir dans Stripe/ })).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/test/customers/cus_1',
    );
  });

  it('badge « Écart » quand la base ne suit pas Stripe', () => {
    mockOverview = {
      data: { ...overview, database: { ...overview.database, status: 'past_due' } },
      isPending: false,
      error: null,
    };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getAllByText('Écart')).toHaveLength(1);
  });

  it('pas de client Stripe : message, pas de lien, revenus affichés', () => {
    mockOverview = {
      data: { ...overview, customer: null, subscription: null, upcomingInvoice: null, dashboardUrl: null },
      isPending: false,
      error: null,
    };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByText('Aucun client Stripe')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ouvrir dans Stripe/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('total-paid')).toHaveTextContent(eur(73.9));
  });

  it('erreur Stripe : message dans l\'encart, revenus toujours affichés', () => {
    mockOverview = { isPending: false, error: new Error('Impossible de lire les données Stripe.') };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByText('Impossible de lire les données Stripe.')).toBeInTheDocument();
    expect(screen.getByTestId('total-paid')).toHaveTextContent(eur(73.9));
  });

  it('erreur du registre : message, état Stripe toujours affiché', () => {
    mockSummary = { isPending: false, error: new Error('Impossible de charger les revenus.') };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByText('Impossible de charger les revenus.')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('abonnement Stripe absent mais base active : « Aucun » avec badge Écart', () => {
    mockOverview = {
      data: { ...overview, subscription: null, upcomingInvoice: null },
      isPending: false,
      error: null,
    };
    render(<BillingSection restaurantId="r1" />);
    const row = screen.getByText('Abonnement', { selector: 'span.text-gray-500' }).parentElement!;
    expect(row).toHaveTextContent('Aucun');
    expect(within(row).getByText('Écart')).toBeInTheDocument();
    expect(row).toHaveTextContent('la base indique Actif');
  });

  it('aucun client Stripe mais base active : badge Écart', () => {
    mockOverview = {
      data: { ...overview, customer: null, subscription: null, upcomingInvoice: null, dashboardUrl: null },
      isPending: false,
      error: null,
    };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByText('Aucun client Stripe')).toHaveTextContent('Écart');
  });

  it('badge Écart : valeur de la base pour les lecteurs d\'écran', () => {
    mockOverview = {
      data: { ...overview, database: { ...overview.database, status: 'past_due' } },
      isPending: false,
      error: null,
    };
    render(<BillingSection restaurantId="r1" />);
    const badge = screen.getByText(/Écart/);
    expect(badge).toHaveAttribute('title', 'La base indique : Impayé');
    expect(badge).toHaveTextContent('la base indique Impayé');
  });

  it('erreur de rechargement Stripe : données conservées, pas d\'encart', () => {
    mockOverview = { data: overview, isPending: false, error: new Error('Impossible de lire les données Stripe.') };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.queryByText('Impossible de lire les données Stripe.')).not.toBeInTheDocument();
  });

  it('erreur de rechargement du registre : données conservées, pas d\'encart', () => {
    mockSummary = { data: summary, isPending: false, error: new Error('Impossible de charger les revenus.') };
    render(<BillingSection restaurantId="r1" />);
    expect(screen.getByTestId('total-paid')).toHaveTextContent(eur(73.9));
    expect(screen.queryByText('Impossible de charger les revenus.')).not.toBeInTheDocument();
  });
});
