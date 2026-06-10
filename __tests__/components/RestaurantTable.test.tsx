import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RestaurantTable } from '@/components/restaurants/RestaurantTable';
import type { Restaurant } from '@/lib/types/restaurant';

const makeRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
  id: 'r1',
  name: 'Le Bistro',
  email: 'bistro@example.com',
  approvalStatus: 'approved',
  subscriptionPlan: 'free',
  isMollieConnected: false,
  commissionRate: 5,
  monthlyRevenue: 1200,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('RestaurantTable', () => {
  it('renders column headers', () => {
    render(<RestaurantTable restaurants={[]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Revenu (MTD)')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<RestaurantTable restaurants={[]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument();
  });

  it('renders restaurant name and email', () => {
    const r = makeRestaurant();
    render(<RestaurantTable restaurants={[r]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('Le Bistro')).toBeInTheDocument();
    expect(screen.getByText('bistro@example.com')).toBeInTheDocument();
  });

  it('renders approval status badge — approved', () => {
    render(<RestaurantTable restaurants={[makeRestaurant({ approvalStatus: 'approved' })]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('Approuvé')).toBeInTheDocument();
  });

  it('renders approval status badge — pending', () => {
    render(<RestaurantTable restaurants={[makeRestaurant({ approvalStatus: 'pending' })]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('renders approval status badge — rejected', () => {
    render(<RestaurantTable restaurants={[makeRestaurant({ approvalStatus: 'rejected' })]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('Rejeté')).toBeInTheDocument();
  });

  it('renders plan badge — premium', () => {
    render(<RestaurantTable restaurants={[makeRestaurant({ subscriptionPlan: 'premium' })]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('Premium ★')).toBeInTheDocument();
  });

  it('renders plan badge — free', () => {
    render(<RestaurantTable restaurants={[makeRestaurant({ subscriptionPlan: 'free' })]} loading={false} onRowClick={jest.fn()} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('calls onRowClick with the restaurant when a row is clicked', () => {
    const onRowClick = jest.fn();
    const r = makeRestaurant();
    render(<RestaurantTable restaurants={[r]} loading={false} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Le Bistro'));
    expect(onRowClick).toHaveBeenCalledWith(r);
  });

  it('shows skeleton rows when loading', () => {
    const { container } = render(<RestaurantTable restaurants={[]} loading={true} onRowClick={jest.fn()} />);
    const animatedRows = container.querySelectorAll('.animate-pulse');
    expect(animatedRows.length).toBe(5);
  });
});
