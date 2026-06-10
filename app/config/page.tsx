'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Clock,
  Percent,
  Globe,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Power,
} from 'lucide-react';
import { usePlatformConfig, useUpdatePlatformConfig } from '@/lib/hooks/usePlatformConfig';

// ─── Editable number field ───────────────────────────────────────────────────

function EditableNumberRow({
  icon: Icon,
  label,
  description,
  value,
  suffix,
  min,
  max,
  step,
  onSave,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  value: number;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const num = parseFloat(draft);
    if (isNaN(num) || (min !== undefined && num < min) || (max !== undefined && num > max)) {
      setError(`Valeur invalide (${min ?? ''}–${max ?? ''})`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(num);
      setEditing(false);
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value.toString());
    setError('');
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
          {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <input
              type="number"
              value={draft}
              min={min}
              max={max}
              step={step ?? 0.1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              autoFocus
              className="w-24 text-sm text-right border border-[#FF6B35] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 pr-8"
            />
            {suffix && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                {suffix}
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            <Check size={13} />
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-100 px-3 py-1 rounded-lg">
            {value}{suffix}
          </span>
          <button
            onClick={() => {
              setDraft(value.toString());
              setEditing(true);
            }}
            className="w-7 h-7 rounded-lg border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#FF6B35] hover:border-[#FF6B35]/30 hover:bg-orange-50 transition-colors"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onSave,
  dangerous,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  value: boolean;
  onSave: (v: boolean) => Promise<void>;
  dangerous?: boolean;
}) {
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    setSaving(true);
    try {
      await onSave(!value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
          dangerous && value ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
        }`}>
          <Icon size={15} className={dangerous && value ? 'text-red-500' : 'text-gray-500'} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={saving}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
          value ? (dangerous ? 'bg-red-500' : 'bg-[#FF6B35]') : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          value ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );
}

// ─── Read-only row ────────────────────────────────────────────────────────────

function ReadOnlyRow({
  icon: Icon,
  label,
  description,
  value,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  value: string;
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
      <span className="text-sm font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-lg flex-shrink-0">
        {value}
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConfigSkeleton() {
  return (
    <div className="px-5 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100" />
            <div>
              <div className="h-3.5 w-32 bg-gray-100 rounded mb-1.5" />
              <div className="h-3 w-48 bg-gray-50 rounded" />
            </div>
          </div>
          <div className="h-7 w-16 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const { data: config, isPending, error } = usePlatformConfig();
  const { mutateAsync } = useUpdatePlatformConfig();

  const updatedLabel = config?.updatedAt
    ? `Modifié le ${config.updatedAt.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })} par ${config.updatedBy ?? 'inconnu'}`
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configuration</h2>
          <p className="text-sm text-gray-500 mt-0.5">Paramètres de la plateforme TheResto</p>
        </div>
        {updatedLabel && (
          <p className="text-xs text-gray-400 mt-1">{updatedLabel}</p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={15} />
          Impossible de charger la configuration
        </div>
      )}

      {/* Platform settings */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Plateforme</h3>
        </div>

        {isPending ? (
          <ConfigSkeleton />
        ) : (
          <div className="px-5">
            <EditableNumberRow
              icon={Percent}
              label="Commission par défaut"
              description="Taux Mollie Connect appliqué aux nouveaux restaurants"
              value={config?.commissionRate ?? 5}
              suffix="%"
              min={0}
              max={100}
              step={0.5}
              onSave={(v) => mutateAsync({ commissionRate: v }).then(() => undefined)}
            />
            <ReadOnlyRow
              icon={Globe}
              label="Devise"
              description="Devise de la plateforme"
              value={config?.currency ?? 'EUR'}
            />
          </div>
        )}
      </div>

      {/* Operations */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Opérations</h3>
        </div>

        {isPending ? (
          <ConfigSkeleton />
        ) : (
          <div className="px-5">
            <ToggleRow
              icon={Power}
              label="Mode maintenance"
              description="Désactive l'accès public à l'application client"
              value={config?.maintenanceMode ?? false}
              dangerous
              onSave={(v) => mutateAsync({ maintenanceMode: v }).then(() => undefined)}
            />
          </div>
        )}
      </div>

      {/* Security — read-only */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Sécurité & Authentification</h3>
          <p className="text-xs text-gray-400 mt-0.5">Paramètres fixes, non modifiables depuis l&apos;interface</p>
        </div>
        <div className="px-5">
          <ReadOnlyRow
            icon={ShieldCheck}
            label="MFA"
            description="Authentification multi-facteurs pour tous les admins"
            value="Obligatoire"
          />
          <ReadOnlyRow
            icon={Clock}
            label="Durée de session"
            description="TTL des sessions administrateurs"
            value="2 heures"
          />
          <ReadOnlyRow
            icon={Globe}
            label="Domaine"
            description="URL de l'interface d'administration"
            value="admin.theresto.fr"
          />
        </div>
      </div>
    </div>
  );
}
