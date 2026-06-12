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
  Globe,
  Instagram,
  Facebook,
  Tag,
  UtensilsCrossed,
  AlertCircle,
  Pencil,
  MapPinned,
  User,
  CalendarDays,
  Image as ImageIcon,
} from 'lucide-react';
import type { Restaurant } from '@/lib/types/restaurant';
import { FeeConfigModal } from './FeeConfigModal';
import { SubscriptionModal } from './SubscriptionModal';
import { ApprovalModal } from './ApprovalModal';
import { EditRestaurantModal } from './EditRestaurantModal';

const ESTABLISHMENT_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  brasserie: 'Brasserie',
  bistrot: 'Bistrot',
  gastronomique: 'Gastronomique',
  pizzeria: 'Pizzeria',
  creperie: 'Crêperie',
  fastFood: 'Fast-food',
  cafe: 'Café',
  traiteur: 'Traiteur',
};

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

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#FF6B35] hover:underline break-all"
          >
            {value}
          </a>
        ) : (
          <p className={`text-sm font-medium text-gray-800 break-words ${mono ? 'font-mono text-xs' : ''}`}>
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function TagList({ tags, color = 'gray' }: { tags: string[]; color?: 'gray' | 'orange' | 'blue' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-600',
    orange: 'bg-orange-50 text-orange-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  if (!tags.length) return <p className="text-sm text-gray-400 px-5 py-3">—</p>;
  return (
    <div className="px-5 py-3 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]}`}>
          {tag}
        </span>
      ))}
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

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

interface Props {
  restaurant: Restaurant;
}

export function RestaurantDetail({ restaurant }: Props) {
  const [modal, setModal] = useState<'fee' | 'subscription' | 'approval' | 'edit' | null>(null);

  const formatCurrency = (v: number) =>
    v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  const approvalCfg = approvalConfig[restaurant.approvalStatus as ApprovalKey] ?? approvalConfig.pending;
  const isPending = restaurant.approvalStatus === 'pending';

  return (
    <>
      <div className="space-y-4 max-w-2xl">

        {/* Pending banner */}
        {isPending && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-800">Restaurant en attente de validation</p>
              <p className="text-xs text-orange-600 mt-0.5">
                Vérifiez les informations ci-dessous avant d'approuver ou rejeter ce restaurant.
              </p>
            </div>
            <button
              onClick={() => setModal('approval')}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              Valider
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{restaurant.name}</h2>
              {restaurant.establishmentType && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {ESTABLISHMENT_LABELS[restaurant.establishmentType] ?? restaurant.establishmentType}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{restaurant.email}</p>
            {(restaurant.rating != null) && (
              <div className="flex items-center gap-1 mt-1">
                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                <span className="text-xs font-semibold text-gray-700">{restaurant.rating.toFixed(1)}</span>
                {restaurant.reviewCount != null && (
                  <span className="text-xs text-gray-400">({restaurant.reviewCount} avis)</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ApprovalBadge status={restaurant.approvalStatus} />
            <button
              onClick={() => setModal('edit')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
            >
              <Pencil size={12} />
              Modifier
            </button>
          </div>
        </div>

        {/* Photo principale */}
        {restaurant.mainPhotoUrl && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <SectionHeader title="Photo principale" />
            <div className="p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={restaurant.mainPhotoUrl}
                alt={restaurant.name}
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Description */}
        {restaurant.description && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <SectionHeader title="Description" />
            <p className="px-5 py-4 text-sm text-gray-700 leading-relaxed">{restaurant.description}</p>
          </div>
        )}

        {/* Coordonnées */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <SectionHeader title="Coordonnées" />
          <div className="px-5">
            <InfoRow icon={Mail} label="Email" value={restaurant.email} />
            <InfoRow icon={Phone} label="Téléphone" value={restaurant.phone ?? ''} />
            <InfoRow icon={MapPin} label="Adresse" value={restaurant.address ?? ''} />
            {restaurant.contact?.website && (
              <InfoRow
                icon={Globe}
                label="Site web"
                value={restaurant.contact.website}
                href={restaurant.contact.website}
              />
            )}
            {restaurant.contact?.instagram && (
              <InfoRow
                icon={Instagram}
                label="Instagram"
                value={restaurant.contact.instagram}
                href={
                  restaurant.contact.instagram.startsWith('http')
                    ? restaurant.contact.instagram
                    : `https://instagram.com/${restaurant.contact.instagram.replace('@', '')}`
                }
              />
            )}
            {restaurant.contact?.facebook && (
              <InfoRow
                icon={Facebook}
                label="Facebook"
                value={restaurant.contact.facebook}
                href={
                  restaurant.contact.facebook.startsWith('http')
                    ? restaurant.contact.facebook
                    : `https://facebook.com/${restaurant.contact.facebook}`
                }
              />
            )}
          </div>
        </div>

        {/* Localisation GPS */}
        {(restaurant.latitude != null || restaurant.longitude != null) && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <SectionHeader title="Localisation GPS" />
            <div className="px-5">
              {restaurant.latitude != null && (
                <InfoRow icon={MapPinned} label="Latitude" value={String(restaurant.latitude)} mono />
              )}
              {restaurant.longitude != null && (
                <InfoRow icon={MapPinned} label="Longitude" value={String(restaurant.longitude)} mono />
              )}
            </div>
          </div>
        )}

        {/* Types de cuisine */}
        {(restaurant.cuisineTypes?.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <SectionHeader title="Types de cuisine" />
            <TagList tags={restaurant.cuisineTypes ?? []} color="orange" />
          </div>
        )}

        {/* Tags */}
        {((restaurant.dietTags?.length ?? 0) > 0 ||
          (restaurant.atmosphereTags?.length ?? 0) > 0 ||
          (restaurant.serviceTags?.length ?? 0) > 0) && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <SectionHeader title="Tags" />
            {(restaurant.dietTags?.length ?? 0) > 0 && (
              <div className="px-5 pt-3">
                <p className="text-xs text-gray-400 mb-1.5">Régimes alimentaires</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {restaurant.dietTags!.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {(restaurant.atmosphereTags?.length ?? 0) > 0 && (
              <div className="px-5 pt-1">
                <p className="text-xs text-gray-400 mb-1.5">Ambiance</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {restaurant.atmosphereTags!.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {(restaurant.serviceTags?.length ?? 0) > 0 && (
              <div className="px-5 pt-1 pb-3">
                <p className="text-xs text-gray-400 mb-1.5">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {restaurant.serviceTags!.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paiement & revenus */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <SectionHeader title="Paiement & revenus" />
          <div className="px-5">
            <InfoRow
              icon={CreditCard}
              label="Mollie Connect"
              value={restaurant.isMollieConnected ? 'Connecté ✓' : 'Non connecté'}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp size={12} className="text-green-600" />
                <p className="text-xs text-gray-500">Revenu total</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(restaurant.totalRevenue ?? 0)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp size={12} className="text-blue-500" />
                <p className="text-xs text-gray-500">Revenu du mois</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(restaurant.monthlyRevenue ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Informations techniques */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <SectionHeader title="Informations techniques" />
          <div className="px-5">
            {restaurant.ownerId && (
              <InfoRow icon={User} label="Propriétaire (UID)" value={restaurant.ownerId} mono />
            )}
            {restaurant.createdAt && (
              <InfoRow icon={CalendarDays} label="Créé le" value={formatDate(restaurant.createdAt) ?? ''} />
            )}
            {restaurant.updatedAt && (
              <InfoRow icon={CalendarDays} label="Mis à jour le" value={formatDate(restaurant.updatedAt) ?? ''} />
            )}
          </div>
        </div>

        {/* Rejet */}
        {restaurant.rejectionReason && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
              Motif de rejet
              {restaurant.rejectedAt && (
                <span className="ml-2 font-normal normal-case text-red-400">
                  ({formatDate(restaurant.rejectedAt)})
                </span>
              )}
            </p>
            <p className="text-sm text-red-800">{restaurant.rejectionReason}</p>
          </div>
        )}

        {/* Gestion */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <SectionHeader title="Gestion" />
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

      {modal === 'edit' && (
        <EditRestaurantModal
          restaurant={restaurant}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
