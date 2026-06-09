'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import type { AuditLogFilter } from '@/lib/types/audit';

export function useAuditLogs(filters: AuditLogFilter) {
  return useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: () => adminApi.getAuditLogs(filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
