import type {
  IncidentMoneyAction,
  PrivatizationIncident,
  PrivatizationIncidentFilter,
  PrivatizationIncidentKind,
} from '@/lib/types/privatizationIncidents';

export const INCIDENT_KIND_LABELS: Record<PrivatizationIncidentKind, string> = {
  refund_failed: 'Remboursement en échec',
  refund_awaiting_iban: 'IBAN du client attendu',
  paid_after_cancellation: 'Payé après annulation',
  customer_balance_funds: 'Virement non rattaché',
  payment_mismatch: 'Paiement non conforme',
};

export const INCIDENT_KIND_HELP: Record<PrivatizationIncidentKind, string> = {
  refund_failed:
    'Stripe a refusé le remboursement ou il a échoué. Relancez-le, ou traitez-le dans le compte Stripe du restaurant.',
  refund_awaiting_iban:
    'Stripe a demandé son IBAN au client par e-mail il y a plus de 7 jours, sans réponse. Contactez le client.',
  paid_after_cancellation:
    'Un paiement a été encaissé alors que la privatisation était annulée ou refusée : remboursez le client.',
  customer_balance_funds:
    "Un virement est arrivé sans paiement à régler : l'argent est sur le solde client Stripe du restaurant. Restituez-le au client.",
  payment_mismatch:
    "Un paiement Stripe désignait cette privatisation sans correspondre au paiement attendu (montant, devise ou paiement déjà enregistré). Il a été ignoré : vérifiez dans le compte Stripe du restaurant qui l'a créé.",
};

export const INCIDENT_FILTERS: { value: PrivatizationIncidentFilter; label: string }[] = [
  { value: 'open', label: 'Ouverts' },
  { value: 'resolved', label: 'Traités' },
  { value: 'ignored', label: 'Ignorés' },
  { value: 'all', label: 'Tous' },
];

export const INCIDENT_STATUS_LABELS: Record<PrivatizationIncident['status'], string> = {
  open: 'Ouvert',
  resolved: 'Traité',
  ignored: 'Ignoré',
};

export const PRIVATIZATION_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  changeRequested: 'Nouvelle date proposée',
  pendingQuoteAcceptance: 'Devis envoyé',
  confirmed: 'Confirmée',
  refused: 'Refusée',
  cancelled: 'Annulée',
  completed: 'Terminée',
};

/** Libellé du bouton d'une action d'argent (le remboursement dépend du type d'incident). */
export function moneyActionLabel(kind: PrivatizationIncidentKind, action: IncidentMoneyAction): string {
  if (action === 'returnCustomerBalance') return 'Restituer au client';
  return kind === 'paid_after_cancellation' ? 'Rembourser le client' : 'Relancer le remboursement';
}

export const RESOLUTION_MIN_LENGTH = 3;
export const RESOLUTION_MAX_LENGTH = 1000;

/** Message d'erreur de la note de résolution, ou null si elle est valide (même règle que le serveur). */
export function resolutionError(note: string): string | null {
  const length = note.trim().length;
  if (length < RESOLUTION_MIN_LENGTH) return "Décrivez en quelques mots comment l'incident a été traité.";
  if (length > RESOLUTION_MAX_LENGTH) return `La note ne doit pas dépasser ${RESOLUTION_MAX_LENGTH} caractères.`;
  return null;
}

/** Détails utiles à l'admin, tirés de `details` et des identifiants Stripe. */
export function incidentDetailLines(incident: PrivatizationIncident): string[] {
  const d = incident.details ?? {};
  const lines: string[] = [];
  const error = d.lastError ?? d.error ?? d.failureReason;
  if (typeof error === 'string' && error) lines.push(`Erreur Stripe : ${error}`);
  if (typeof d.attempts === 'number' && d.attempts > 0) lines.push(`Tentatives : ${d.attempts}`);
  if (typeof d.refundStatus === 'string') lines.push(`Statut du remboursement : ${d.refundStatus}`);
  if (d.method === 'bank_transfer' || d.method === 'card') {
    lines.push(`Moyen : ${d.method === 'bank_transfer' ? 'virement' : 'carte'}`);
  }
  if (incident.stripeObjectId) lines.push(`Objet Stripe : ${incident.stripeObjectId}`);
  if (incident.stripeAccountId) lines.push(`Compte Stripe : ${incident.stripeAccountId}`);
  return lines;
}
