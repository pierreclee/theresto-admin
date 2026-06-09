'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminUser } from '@/lib/types/admin';

export function useAdminUsers() {
  return useQuery({
    queryKey: ['adminUsers'],
    queryFn: async (): Promise<AdminUser[]> => [],
    staleTime: 10 * 60 * 1000,
  });
}
