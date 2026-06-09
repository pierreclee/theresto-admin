'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/mfa-enrollment',
  '/auth/mfa-challenge',
  '/auth/access-denied',
];

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, hasMfa, sessionValid, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    // If not authenticated, redirect to login (unless on public route)
    if (!user) {
      if (!isPublicRoute) {
        router.push('/auth/login');
      }
      return;
    }

    // If user is not admin, redirect to access denied
    if (!isAdmin) {
      router.push('/auth/access-denied');
      return;
    }

    // If user hasn't enrolled MFA, redirect to enrollment (unless already there)
    if (!hasMfa && pathname !== '/auth/mfa-enrollment') {
      router.push('/auth/mfa-enrollment');
      return;
    }

    // If MFA is enrolled but session is not valid, require challenge
    if (hasMfa && !sessionValid && !isPublicRoute) {
      router.push('/auth/mfa-challenge');
      return;
    }

    // If authenticated, admin, MFA enrolled/verified, and on public route, go to dashboard
    if (isPublicRoute && user && isAdmin && hasMfa && sessionValid) {
      router.push('/');
    }
  }, [user, isAdmin, hasMfa, sessionValid, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  return children;
}
