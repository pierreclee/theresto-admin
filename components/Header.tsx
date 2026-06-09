'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

export function Header() {
  const { adminUser, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Hide header on auth pages
  if (pathname.startsWith('/auth/')) {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-30">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-gray-800">Tableau de bord administrateur</h2>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{adminUser?.displayName || 'Admin'}</p>
            <p className="text-xs text-gray-500">{adminUser?.email}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-semibold">
              {(adminUser?.displayName || adminUser?.email || 'A')[0].toUpperCase()}
            </span>
          </div>
        </div>

        <div className="border-l border-gray-200 pl-6">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
          </button>
        </div>
      </div>
    </header>
  );
}
