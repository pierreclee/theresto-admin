'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const routes = [
  { href: '/', label: 'Tableau de bord', icon: '📊' },
  { href: '/restaurants', label: 'Restaurants', icon: '🏪' },
  { href: '/users', label: 'Utilisateurs', icon: '👥' },
  { href: '/monitoring', label: 'Monitoring', icon: '📡' },
  { href: '/config', label: 'Configuration', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar on auth pages
  if (pathname.startsWith('/auth/')) {
    return null;
  }

  return (
    <aside className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 overflow-y-auto z-40 shadow-lg">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">TheResto</h1>
        <p className="text-xs text-gray-400 mt-1">Administration</p>
      </div>

      <nav className="px-4 py-6 space-y-2">
        {routes.map((route) => {
          const isActive = pathname === route.href;
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`flex items-center px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="mr-3 text-lg">{route.icon}</span>
              <span>{route.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 bg-gray-800 bg-opacity-50">
        <p className="text-xs text-gray-400">v1.0.0</p>
      </div>
    </aside>
  );
}
