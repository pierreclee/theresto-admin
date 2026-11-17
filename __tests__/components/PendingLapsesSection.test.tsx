import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PendingLapsesSection, RestaurantAlertsBox } from '@/components/restaurants/PendingLapsesSection';
import { ActionError } from '@/lib/api/actionResult';
import { rateAxisMax } from '@/lib/utils/restaurantAlerts';

const RID = '11111111-2222-4333-8444-555555555555';
let detailQuery: Record<string, unknown>;
let alertsQuery: Record<string, unknown>;
const offsets: number[] = [];

jest.mock('@/lib/hooks/useRestaurantAlerts', () => ({
  usePendingLapseDetail: (_id: string, offset: number) => { offsets.push(offset); return detailQuery; },
  useRestaurantAlerts: () => alertsQuery,
}));

const week = (i: number, tracked: boolean) => ({
  period_start: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  period_end: `2026-09-${String(i + 8).padStart(2, '0')}T00:00:00Z`,
  lapsed: tracked ? i : 0, total: tracked ? 10 : 0, rate: tracked ? i / 10 : null, tracked,
});
const detail = {
  restaurant_id: RID,
  computed_at: '2026-11-30T10:00:00Z',
  settings: { pending_lapse_min_count: 5, pending_lapse_min_rate: 0.1, pending_lapse_tracking_since: '2026-11-17T00:00:00Z' },
  current: { lapsed: 6, total: 40, rate: 0.15, last_lapse_at: '2026-11-29T22:00:00Z', alert: true },
  previous: { lapsed: 1, total: 30, rate: 0.0333 },
  trend: [week(0, false), week(1, true), week(2, true)],
  closures: {
    days: 30, total: 25, limit: 20, offset: 0,
    items: [{ booking_date: '2026-11-29', booking_time: '20:00', number_of_guests: 4, booking_source: 'widget',
      reservation_type: 'tableReservation', previous_status: 'pending', service_end_at: '2026-11-29T22:00:00Z',
      closed_at: '2026-11-29T22:15:00Z' }],
  },
};

describe('PendingLapsesSection', () => {
  beforeEach(() => {
    offsets.length = 0;
    detailQuery = { data: detail, error: null, isPending: false, isFetching: false };
  });

  it('compteurs, seuils, comparaison et fermetures sans donnée de client', () => {
    render(<PendingLapsesSection restaurantId={RID} />);
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Au-dessus des seuils : en alerte')).toBeInTheDocument();
    expect(screen.getByText(/^15\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/30 jours précédents : 3,33\s% \(1 sur 30\)/)).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText(/semaines antérieures au début du suivi/)).toBeInTheDocument();
    expect(screen.getByText('1–1 sur 25')).toBeInTheDocument();
  });

  it('seuils : un espace entre le nombre et « demandes »', () => {
    render(<PendingLapsesSection restaurantId={RID} />);
    expect(screen.getByText(/Alerte à partir de/).textContent).toMatch(/Alerte à partir de 5 demandes non confirmées/);
  });

  it('courbe : nombre (barres) et taux (ligne, axe de droite, seuil)', () => {
    render(<PendingLapsesSection restaurantId={RID} />);
    expect(screen.getByText('Nombre (axe de gauche)')).toBeInTheDocument();
    expect(screen.getByText('Taux (axe de droite)')).toBeInTheDocument();
    expect(screen.getByText(/Seuil de taux \(10\s%\)/)).toBeInTheDocument();
    // Un point par semaine suivie avec un taux ; la semaine non suivie n'en a pas.
    expect(screen.getAllByTestId('rate-point')).toHaveLength(2);
    expect(screen.getAllByTestId('rate-line')).toHaveLength(1);
    expect(screen.getByTestId('rate-threshold')).toBeInTheDocument();
    // Le tableau dépliable reste là.
    expect(screen.getByText('Voir le tableau')).toBeInTheDocument();
  });

  it('page suivante', () => {
    render(<PendingLapsesSection restaurantId={RID} />);
    fireEvent.click(screen.getByLabelText('Page suivante'));
    expect(offsets).toContain(20);
  });

  it('refus faute de journal : seul le message est affiché', () => {
    detailQuery = {
      data: undefined, error: new ActionError('Consultation impossible : le journal…', 'audit-log-failed'),
      isPending: false, isFetching: false,
    };
    render(<PendingLapsesSection restaurantId={RID} />);
    expect(screen.getByText('Consultation impossible : le journal…')).toBeInTheDocument();
    expect(screen.queryByText('Fermée le')).not.toBeInTheDocument();
  });
});

describe('RestaurantAlertsBox', () => {
  it('liste les alertes, type inconnu compris', () => {
    alertsQuery = {
      data: { alerts: [
        { restaurantId: RID, restaurantName: 'X', kind: 'restaurant_suspended', severity: 'critical', since: null, metrics: {} },
        { restaurantId: RID, restaurantName: 'X', kind: 'ontime_new', severity: 'info', since: '2026-11-01T10:00:00Z', metrics: {} },
      ], total: 2, totalRestaurants: 1 },
      error: null, isPending: false,
    };
    render(<RestaurantAlertsBox restaurantId={RID} />);
    expect(screen.getByText('Restaurant suspendu')).toBeInTheDocument();
    expect(screen.getByText('Autre alerte')).toBeInTheDocument();
    expect(screen.getByText('Critique')).toBeInTheDocument();
  });

  it('aucune alerte : rien', () => {
    alertsQuery = { data: { alerts: [], total: 0, totalRestaurants: 0 }, error: null, isPending: false };
    const { container } = render(<RestaurantAlertsBox restaurantId={RID} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('rateAxisMax', () => {
  const w = (rate: number | null, tracked = true) =>
    ({ period_start: 'a', period_end: 'b', lapsed: 0, total: 0, rate, tracked });
  it('arrondi à la dizaine supérieure, au moins le seuil, 100 % au plus', () => {
    expect(rateAxisMax([w(0.03)], 0.1)).toBe(0.1);
    expect(rateAxisMax([w(0.23)], 0.1)).toBe(0.3);
    expect(rateAxisMax([w(0.2)], 0.1)).toBe(0.2);
    expect(rateAxisMax([w(0.05)], 0.35)).toBe(0.4);
    expect(rateAxisMax([w(1)], 0.1)).toBe(1);
    expect(rateAxisMax([w(null), w(0.9, false)], null)).toBe(0.1);
  });
});
