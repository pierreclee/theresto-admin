'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import type { UpdatePlatformConfigInput } from '@/lib/types/config';

export function usePlatformConfig() {
  return useQuery({
    queryKey: ['platformConfig'],
    queryFn: () => adminApi.getConfig(),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useUpdatePlatformConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: UpdatePlatformConfigInput) => adminApi.updateConfig(updates),
    onSuccess: (data) => {
      queryClient.setQueryData(['platformConfig'], data);
    },
  });
}
