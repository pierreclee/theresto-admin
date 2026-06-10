'use client';

import { Providers } from '@/components/AuthProvider';
import { AdminGuard } from '@/components/AdminGuard';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AdminGuard>
        <Sidebar />
        <Header />
        <main className="ml-64 pt-14 min-h-screen bg-gray-50">
          <div className="p-6 max-w-7xl">
            {children}
          </div>
        </main>
      </AdminGuard>
    </Providers>
  );
}
