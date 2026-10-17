'use client';

import { ShieldCheck } from 'lucide-react';

/** Champ du code à 6 chiffres de l'application d'authentification. */
export function TotpCodeField({
  value,
  onChange,
  onSubmit,
  disabled,
  hint = 'Requis pour toute modification de tarif, même si vous êtes déjà connecté.',
}: {
  value: string;
  onChange: (code: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor="totp-code" className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
        <ShieldCheck size={13} className="text-[#FF6B35]" />
        Code de votre application d&apos;authentification
      </label>
      <input
        id="totp-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && value.length === 6 && !disabled && onSubmit()}
        autoFocus
        disabled={disabled}
        placeholder="000000"
        className="w-full text-center text-2xl tracking-[0.4em] font-mono border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 disabled:opacity-60"
      />
      <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
    </div>
  );
}
