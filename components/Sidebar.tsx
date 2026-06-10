'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Store,
  Users,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';

const routes = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { href: '/restaurants', label: 'Restaurants', icon: Store },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/config', label: 'Configuration', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { adminUser, signOut } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (pathname.startsWith('/auth/')) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/auth/login');
    } catch {
      setIsLoggingOut(false);
    }
  };

  const isActive = (route: { href: string; exact?: boolean }) =>
    route.exact ? pathname === route.href : pathname.startsWith(route.href);

  return (
    <aside className="w-64 bg-[#0F1629] text-white h-screen fixed left-0 top-0 flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm">TR</span>
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">TheResto</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Administration</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold text-white/30 uppercase tracking-widest">Menu</p>
        {routes.map((route) => {
          const active = isActive(route);
          const Icon = route.icon;
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-[#FF6B35] text-white shadow-lg shadow-[#FF6B35]/20'
                  : 'text-white/60 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon
                size={17}
                className={`flex-shrink-0 transition-transform duration-150 ${active ? '' : 'group-hover:scale-110'}`}
              />
              <span className="flex-1">{route.label}</span>
              {active && <ChevronRight size={14} className="opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* User profile + logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5">
          <div className="w-7 h-7 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/40 flex items-center justify-center flex-shrink-0">
            <span className="text-[#FF6B35] text-xs font-bold">
              {(adminUser?.displayName || adminUser?.email || 'A')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {adminUser?.displayName || 'Admin'}
            </p>
            <p className="text-[10px] text-white/40 truncate">{adminUser?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Déconnexion"
            className="text-white/40 hover:text-red-400 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
