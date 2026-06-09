'use client';

import { Card } from '@/components/shared/Card';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Utilisateurs Admin</h1>
        <p className="text-gray-600 mt-2">Gérez les admins et leurs permissions</p>
      </div>

      <Card>
        <p className="text-gray-600">Gestion des utilisateurs en construction...</p>
      </Card>
    </div>
  );
}
