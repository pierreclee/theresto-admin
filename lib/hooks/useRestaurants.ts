'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { useToast } from '@/components/shared/Toaster';
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
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, updates }: { restaurantId: string; updates: UpdateRestaurantInput }) =>
      adminApi.updateRestaurant(restaurantId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.setQueryData(['restaurant', data.id], data);
      toast('Restaurant mis à jour');
    },
    onError: () => toast('Erreur lors de la mise à jour', 'error'),
  });
}

export function useSetAdminFee() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, feePercent }: { restaurantId: string; feePercent: number }) =>
      adminApi.setAdminFee(restaurantId, feePercent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      toast('Commission mise à jour');
    },
    onError: () => toast('Erreur lors de la mise à jour', 'error'),
  });
}

export function useApproveRestaurant() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      status,
      reason,
      correctionMode,
    }: {
      restaurantId: string;
      status: 'approved' | 'rejected' | 'suspended';
      reason?: string;
      correctionMode?: 'correction_required' | 'permanent';
    }) => adminApi.approveRestaurant(restaurantId, status, reason, correctionMode),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', vars.restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['platformStats'] });
      toast('Statut du restaurant mis à jour');
    },
    onError: () => toast('Erreur lors de la mise à jour du statut', 'error'),
  });
}

export function useUpdateSubscription() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      plan,
    }: {
      restaurantId: string;
      plan: 'free' | 'croissance' | 'liberte' | 'premium';
    }) => adminApi.updateSubscriptionPlan(restaurantId, plan),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', vars.restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['platformStats'] });
      toast('Abonnement mis à jour');
    },
    onError: () => toast('Erreur lors de la mise à jour de l\'abonnement', 'error'),
  });
}
