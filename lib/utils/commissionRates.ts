import type { CommissionInvoiceStatus } from '@/lib/types/commissions';

// Mêmes règles que la validation de l'Edge Function commission-settings
// (parseFee / parseIntInRange) : chiffres uniquement, 2 décimales au plus.
const EURO_PATTERN = /^\d+([.,]\d{1,2})?$/;
const MONTHS_PATTERN = /^\d+$/;

/** Montant saisi en euros (« 0,25 » ou « 0.25 ») entre 0 et [max], 2 décimales au plus. null si invalide. */
export function parseEuroInput(raw: string, max = 100): number | null {
  const trimmed = raw.trim();
  if (!EURO_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0 || value > max) return null;
  return Math.round(value * 100) / 100;
}

/** Nombre de mois entier entre 0 et 12. null si invalide. */
export function parseMonthsInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!MONTHS_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= 12 ? value : null;
}

/** « 1,00 € » */
export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

/** '2026-10-01' → « octobre 2026 » */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/**
 * Le restaurant est-il facturé à la commission ? Même règle que public.plan_rank
 * côté base : tout plan autre que croissance / liberte / premium (y compris null)
 * compte comme Essentiel.
 */
export function isEssentielPlan(plan: string | null): boolean {
  return !['croissance', 'liberte', 'premium'].includes((plan ?? '').toLowerCase());
}

export const INVOICE_STATUS_LABELS: Record<CommissionInvoiceStatus, string> = {
  draft: 'En préparation',
  open: 'En attente de paiement',
  paid: 'Payée',
  failed: 'Échec du prélèvement',
  uncollectible: 'Impayée',
  void: 'Annulée',
};
