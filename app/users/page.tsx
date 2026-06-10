'use client';

import { Users, ShieldCheck, Clock } from 'lucide-react';

export default function UsersPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Utilisateurs Admin</h2>
        <p className="text-sm text-gray-500 mt-0.5">Gestion des accès administrateurs</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-10 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
          <Users size={24} className="text-gray-300" />
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Gestion des utilisateurs</p>
        <p className="text-xs text-gray-400 max-w-xs">
          Cette section permettra de gérer les comptes administrateurs et leurs niveaux d'accès.
        </p>
        <div className="flex gap-3 mt-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <ShieldCheck size={13} className="text-green-500" />
            MFA obligatoire
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <Clock size={13} className="text-blue-500" />
            Session 2h
          </div>
        </div>
      </div>
    </div>
  );
}
