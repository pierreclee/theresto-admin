'use client';

import { useState } from 'react';
import {
  Phone,
  MapPin,
  Mail,
  CreditCard,
  Star,
  TrendingUp,
  Percent,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldOff,
} from 'lucide-react';
import type { Restaurant } from '@/lib/types/restaurant';
import { FeeConfigModal } from './FeeConfigModal';
import { SubscriptionModal } from './SubscriptionModal';
import { ApprovalModal } from './ApprovalModal';

const approvalConfig = {
  pending: { label: 'En attente', className: 'bg-orange-50 text-orange-700 border-orange-100', icon: Clock },
  approved: { label: 'Approuvé', className: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle2 },
  rejected: { label: 'Rejeté', className: 'bg-red-50 text-red-700 border-red-100', icon: XCircle },
  suspended: { label: 'Suspendu', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: ShieldOff },
} as const;

type ApprovalKey = keyof typeof approvalConfig;

function ApprovalBadge({ status }: { status: string }) {
  const cfg = approvalConfig[status as ApprovalKey] ?? approvalConfig.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon size={13} className="text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  sublabel,
  onClick,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:border-[#FF6B35]/30 hover:bg-orange-50/40 transition-colors group text-left"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          accent ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50 border border-gray-100'
        }`}>
          <Icon size={14} className={accent ? 'text-yellow-600' : 'text-gray-500'} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
        </div>
      </div>
      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#FF6B35] transition-colors flex-shrink-0" />
    </button>
  );
}

interface Props {
  restaurant: Restaurant;
}

export function RestaurantDetail({ restaurant }: Props) {
  const [modal, setModal] = useState<'fee' | 'subscription' | 'approval' | null>(null);

  const formatCurrency = (v: number) =>
    v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  const approvalCfg = approvalConfig[restaurant.approvalStatus as ApprovalKey] ?? approvalConfig.pending;

  return (
    <>
      <div className="space-y-5 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{restaurant.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{restaurant.email}</p>
          </div>
          <ApprovalBadge status={restaurant.approvalStatus} />
        </div>

        {/* Informations */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Informations</h3>
          </div>
          <div className="px-5">
            <InfoRow icon={Mail} label="Email" value={restaurant.email} />
            <InfoRow icon={Phone} label="Téléphone" value={restaurant.phone ?? ''} />
            <InfoRow icon={MapPin} label="Adresse" value={restaurant.address ?? ''} />
            <InfoRow
              icon={CreditCard}
              label="Mollie Connect"
              value={restaurant.isMollieConnected ? 'Connecté' : 'Non connecté'}
            />
          </div>
        </div>

        {/* Revenue */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center">
                <TrendingUp size={13} className="text-green-600" />
              </div>
              <p className="text-xs text-gray-500">Revenu total</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(restaurant.totalRevenue ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <TrendingUp size={13} className="text-blue-500" />
              </div>
              <p className="text-xs text-gray-500">Revenu du mois</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(restaurant.monthlyRevenue ?? 0)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Gestion</h3>
          </div>
          <div className="p-3 space-y-1.5">
            <ActionRow
              icon={Star}
              label="Abonnement"
              sublabel={
                restaurant.subscriptionPlan === 'premium'
                  ? 'Premium ★ — cliquer pour rétrograder'
                  : 'Free — cliquer pour activer Premium'
              }
              onClick={() => setModal('subscription')}
              accent={restaurant.subscriptionPlan === 'premium'}
            />
            <ActionRow
              icon={Percent}
              label="Commission TheResto"
              sublabel={`Taux actuel : ${restaurant.commissionRate}%`}
              onClick={() => setModal('fee')}
            />
            <ActionRow
              icon={approvalCfg.icon}
              label="Statut d'approbation"
              sublabel={`Actuellement : ${approvalCfg.label}`}
              onClick={() => setModal('approval')}
            />
          </div>
        </div>
      </div>

      {modal === 'fee' && (
        <FeeConfigModal
          isOpen
          onClose={() => setModal(null)}
          restaurantId={restaurant.id}
          currentFee={restaurant.commissionRate}
        />
      )}

      {modal === 'subscription' && (
        <SubscriptionModal
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          currentPlan={restaurant.subscriptionPlan}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'approval' && (
        <ApprovalModal
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          currentStatus={restaurant.approvalStatus as 'pending' | 'approved' | 'rejected' | 'suspended'}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
