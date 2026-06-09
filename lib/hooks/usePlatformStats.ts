'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platformStats'],
    queryFn: () => adminApi.getStats(),
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });
}
