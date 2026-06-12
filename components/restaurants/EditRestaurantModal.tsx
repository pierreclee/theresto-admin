'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useUpdateRestaurant } from '@/lib/hooks/useRestaurants';
import type { Restaurant } from '@/lib/types/restaurant';

const ESTABLISHMENT_TYPES: Record<string, string> = {
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]';

interface Props {
  restaurant: Restaurant;
  onClose: () => void;
}

export function EditRestaurantModal({ restaurant, onClose }: Props) {
  const { mutateAsync, isPending } = useUpdateRestaurant();
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: restaurant.name || '',
    description: restaurant.description || '',
    establishmentType: restaurant.establishmentType || '',
    email: restaurant.email || restaurant.contact?.email || '',
    phone: restaurant.phone || restaurant.contact?.phone || '',
    address: restaurant.address || '',
    website: restaurant.contact?.website || '',
    instagram: restaurant.contact?.instagram || '',
    facebook: restaurant.contact?.facebook || '',
    cuisineTypes: (restaurant.cuisineTypes ?? []).join(', '),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setError('');
    try {
      await mutateAsync({
        restaurantId: restaurant.id,
        updates: {
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          description: form.description.trim() || undefined,
          establishmentType: form.establishmentType || undefined,
          cuisineTypes: form.cuisineTypes
            ? form.cuisineTypes.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
          contact: {
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            website: form.website.trim() || null,
            instagram: form.instagram.trim() || null,
            facebook: form.facebook.trim() || null,
          },
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Modifier le restaurant</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          <Field label="Nom" required>
            <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Nom du restaurant" />
          </Field>

          <Field label="Type d'établissement">
            <select className={inputCls} value={form.establishmentType} onChange={set('establishmentType')}>
              <option value="">— Non défini —</option>
              {Object.entries(ESTABLISHMENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              className={`${inputCls} resize-none`}
              value={form.description}
              onChange={set('description')}
              rows={4}
              placeholder="Décrivez l'établissement…"
            />
          </Field>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact</p>
            <div className="space-y-3">
              <Field label="Email">
                <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="contact@restaurant.fr" />
              </Field>
              <Field label="Téléphone">
                <input className={inputCls} type="tel" value={form.phone} onChange={set('phone')} placeholder="+33 6 00 00 00 00" />
              </Field>
              <Field label="Site web">
                <input className={inputCls} value={form.website} onChange={set('website')} placeholder="https://www.restaurant.fr" />
              </Field>
              <Field label="Instagram">
                <input className={inputCls} value={form.instagram} onChange={set('instagram')} placeholder="@restaurant" />
              </Field>
              <Field label="Facebook">
                <input className={inputCls} value={form.facebook} onChange={set('facebook')} placeholder="facebook.com/restaurant" />
              </Field>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Localisation</p>
            <Field label="Adresse">
              <input className={inputCls} value={form.address} onChange={set('address')} placeholder="12 rue de la Paix, 75001 Paris" />
            </Field>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Types de cuisine</p>
            <Field label="Cuisines (séparées par des virgules)">
              <input
                className={inputCls}
                value={form.cuisineTypes}
                onChange={set('cuisineTypes')}
                placeholder="française, italienne, végétarienne…"
              />
            </Field>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FF6B35] hover:bg-[#e55e2a] rounded-xl transition-colors disabled:opacity-50"
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
