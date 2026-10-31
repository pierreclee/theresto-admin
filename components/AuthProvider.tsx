'use client';

import { AuthProvider } from '@/lib/auth/context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { shouldRetryQuery } from '@/lib/api/actionResult';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery } } });

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
