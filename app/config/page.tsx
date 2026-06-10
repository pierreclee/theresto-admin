'use client';

import { ShieldCheck, Clock, Percent, Globe } from 'lucide-react';

function ConfigRow({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-100 px-3 py-1 rounded-lg">
        {value}
      </span>
    </div>
  );
}

export default function ConfigPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Configuration</h2>
        <p className="text-sm text-gray-500 mt-0.5">Paramètres de la plateforme TheResto</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Sécurité & Authentification</h3>
        </div>
        <div className="px-5">
          <ConfigRow
            icon={ShieldCheck}
            label="MFA"
            value="Obligatoire"
            description="Authentification multi-facteurs pour tous les admins"
          />
          <ConfigRow
            icon={Clock}
            label="Durée de session"
            value="2 heures"
            description="TTL des sessions administrateurs"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Plateforme</h3>
        </div>
        <div className="px-5">
          <ConfigRow
            icon={Percent}
            label="Commission par défaut"
            value="5%"
            description="Taux Mollie Connect appliqué aux nouveaux restaurants"
          />
          <ConfigRow
            icon={Globe}
            label="Domaine"
            value="admin.theresto.fr"
            description="URL de l'interface d'administration"
          />
        </div>
      </div>
    </div>
  );
}
