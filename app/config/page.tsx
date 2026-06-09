'use client';

import { Card } from '@/components/shared/Card';

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuration</h1>
        <p className="text-gray-600 mt-2">Paramètres de l'administration</p>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">MFA</h2>
        <p className="text-gray-600 mb-4">
          L'authentification multi-facteurs est obligatoire pour tous les admins.
        </p>
        <p className="text-sm text-gray-500">Session TTL: 2 heures</p>
      </Card>
    </div>
  );
}
