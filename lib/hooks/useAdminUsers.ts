'use client';

import { useQuery } from '@tanstack/react-query';

export interface AdminUser {
  uid: string;
  email: string;
  role: 'super_admin' | 'admin' | 'read_only';
  mfaEnrolled: boolean;
  addedBy?: string;
  addedAt: Date;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['adminUsers'],
    queryFn: async (): Promise<AdminUser[]> => [],
    staleTime: 10 * 60 * 1000,
  });
}
