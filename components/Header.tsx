'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Server } from 'lucide-react';
import { getClientEnvironment } from '@/lib/supabase/client';
import type { AppEnvironment } from '@/lib/supabase/config';

const pageTitles: Record<string, string> = {
  '/': 'Tableau de bord',
  '/restaurants': 'Restaurants',
  '/users': 'Utilisateurs',
  '/monitoring': 'Monitoring',
  '/config': 'Configuration',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/restaurants/')) return 'Détail restaurant';
  return 'Administration';
}

export function Header() {
  const pathname = usePathname();
  const [env, setEnv] = useState<AppEnvironment>('staging');

  useEffect(() => {
    setEnv(getClientEnvironment());
  }, []);

  if (pathname.startsWith('/auth/')) return null;

  const title = getPageTitle(pathname);
  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <header className="fixed top-0 left-64 right-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 z-30">
      <div>
        <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400 capitalize">{date}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Environment Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
          env === 'production' 
            ? 'bg-red-50 text-red-600 border border-red-100' 
            : 'bg-green-50 text-green-600 border border-green-100'
        }`}>
          <Server size={14} />
          <span className="uppercase tracking-wider">
            {env === 'production' ? 'PROD' : 'STAGING'}
          </span>
        </div>

        <div className="h-4 w-px bg-gray-200"></div>

        <button
          title="Notifications"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors relative"
        >
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}
