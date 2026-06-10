'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { useToast } from '@/components/shared/Toaster';
import type { ModerationAction } from '@/lib/types/user';

export function useUsers(filters: { roleFilter?: string; statusFilter?: string }) {
  const [cursor, setCursor] = useState<Parameters<typeof usersApi.listUsers>[0]['cursor']>(undefined);
  const [allPages, setAllPages] = useState<Awaited<ReturnType<typeof usersApi.listUsers>>[]>([]);

  const query = useQuery({
    queryKey: ['users', filters, cursor ? 'paged' : 'first'],
    queryFn: () => usersApi.listUsers({ ...filters, cursor }),
    staleTime: 2 * 60 * 1000,
  });

  const users = useMemo(() => {
    const current = query.data?.users ?? [];
    const previous = allPages.flatMap((p) => p.users);
    const ids = new Set(previous.map((u) => u.id));
    return [...previous, ...current.filter((u) => !ids.has(u.id))];
  }, [query.data, allPages]);

  const loadMore = () => {
    if (query.data?.cursor) {
      setAllPages((prev) => [...prev, query.data!]);
      setCursor(query.data.cursor);
    }
  };

  const reset = () => {
    setAllPages([]);
    setCursor(undefined);
  };

  return {
    users,
    isPending: query.isPending,
    error: query.error,
    hasMore: !!query.data?.cursor,
    loadMore,
    reset,
  };
}

export function useUserCrmProfile(userId: string | null) {
  return useQuery({
    queryKey: ['userCrm', userId],
    queryFn: () => usersApi.getCrmProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useModerateUser() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      action,
      reason,
    }: {
      userId: string;
      action: ModerationAction;
      reason?: string;
    }) => usersApi.moderateUser(userId, action, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userCrm', vars.userId] });
      toast('Compte utilisateur mis à jour');
    },
    onError: () => toast('Erreur lors de la modération', 'error'),
  });
}
