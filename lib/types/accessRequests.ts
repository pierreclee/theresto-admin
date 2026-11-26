// Demandes d'ouverture d'un espace restaurant (contrat : section « Demande d'ouverture d'un
// espace restaurant » de docs/features/onboarding-accompagne.md du dépôt de l'app).

export type AccessRequestStatus = 'pending' | 'invited' | 'declined';
export type AccessRequestFilter = AccessRequestStatus | 'all';

export interface AccessRequest {
  id: string;
  userId: string;
  restaurantName: string;
  city: string;
  /** E.164. */
  phone: string;
  message: string | null;
  status: AccessRequestStatus;
  createdAt: string;
  handledAt: string | null;
  /** Adresse du compte Auth ; null si le compte n'existe plus. */
  email: string | null;
}

export interface AccessRequestList {
  requests: AccessRequest[];
  /** Liste limitée aux plus récentes (borne haute de la RPC). */
  truncated: boolean;
}

export interface DeclinedAccessRequest {
  id: string;
  status: AccessRequestStatus;
  handledAt: string | null;
  /** False : demande refusée, mais la ligne du journal n'a pas pu être écrite (D2). */
  auditLogged: boolean;
}
