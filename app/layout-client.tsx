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
        <main className="ml-64 mt-16 p-6 bg-gray-50 min-h-screen">
          {children}
        </main>
      </AdminGuard>
    </Providers>
  );
}
