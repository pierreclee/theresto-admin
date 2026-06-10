'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import type { UpdateRestaurantInput } from '@/lib/types/restaurant';

export function useRestaurants(filters?: { status?: string; subscription?: string; search?: string }) {
  return useQuery({
    queryKey: ['restaurants', filters],
    queryFn: () => adminApi.getRestaurants(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useRestaurantDetail(restaurantId: string) {
  return useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => adminApi.getRestaurantDetail(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateRestaurant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, updates }: { restaurantId: string; updates: UpdateRestaurantInput }) =>
      adminApi.updateRestaurant(restaurantId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.setQueryData(['restaurant', data.id], data);
    },
  });
}

export function useSetAdminFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, feePercent }: { restaurantId: string; feePercent: number }) =>
      adminApi.setAdminFee(restaurantId, feePercent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
  });
}

export function useApproveRestaurant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      status,
      reason,
    }: {
      restaurantId: string;
      status: 'approved' | 'rejected' | 'suspended';
      reason?: string;
    }) => adminApi.approveRestaurant(restaurantId, status, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', vars.restaurantId] });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      plan,
    }: {
      restaurantId: string;
      plan: 'free' | 'premium';
    }) => adminApi.updateSubscriptionPlan(restaurantId, plan),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', vars.restaurantId] });
    },
  });
}
