/** Ancienneté maximale du dernier code TOTP vérifié (même règle que verifyRecentMfa côté Edge Functions). */
export const RECENT_MFA_MAX_AGE_SECONDS = 300;

/**
 * Durée d'une session admin, comptée depuis le dernier code TOTP vérifié (claim
 * `amr`) : au-delà, le code doit être ressaisi. Même règle côté navigateur
 * (AuthProvider, adminSessionExpiresAt) et côté serveur (requireAdmin, hasRecentTotp).
 */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 2 * 60 * 60;

/** Code des refus pour second facteur absent ou trop ancien (même code que updateSubscriptionPlanAction). */
export const MFA_REQUIRED_CODE = 'mfa-required';

/** Levée par requireAdmin quand la session n'est pas AAL2 ou que le code TOTP a plus de 2 h. */
export class MfaRequiredError extends Error {
  readonly code = MFA_REQUIRED_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'MfaRequiredError';
  }
}

export const RECENT_MFA_REQUIRED_MESSAGE =
  "Vérification en deux étapes expirée. Saisissez un nouveau code de votre application d'authentification.";

interface JwtClaims {
  aal?: string;
  amr?: { method?: string; timestamp?: number }[];
}

function decodeClaims(token: string): JwtClaims | null {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * Vrai si le jeton d'accès est AAL2 et qu'un code TOTP a été vérifié il y a
 * au plus [maxAgeSeconds] (claim `amr`). Le jeton doit déjà avoir été validé
 * (requireAdmin appelle auth.getUser) ; seule sa fraîcheur MFA est contrôlée ici.
 */
export function hasRecentTotp(
  accessToken: string | undefined | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  maxAgeSeconds: number = RECENT_MFA_MAX_AGE_SECONDS,
): boolean {
  if (!accessToken) return false;
  const claims = decodeClaims(accessToken);
  if (!claims || claims.aal !== 'aal2') return false;
  return (claims.amr ?? []).some(
    (entry) =>
      entry.method === 'totp' && typeof entry.timestamp === 'number' && nowSeconds - entry.timestamp <= maxAgeSeconds,
  );
}

/**
 * Vrai si le jeton d'accès est de niveau AAL2 : le second facteur a été vérifié
 * dans cette session. Exigé par requireAdmin pour toute action admin (RGPD-28).
 * Le jeton doit avoir été validé auprès de Supabase (requireAdmin le passe à auth.getUser).
 */
export function hasAal2(accessToken: string | undefined | null): boolean {
  if (!accessToken) return false;
  return decodeClaims(accessToken)?.aal === 'aal2';
}

/** Niveau de la session tel que renvoyé par auth.mfa.getAuthenticatorAssuranceLevel(). */
export interface SessionAssurance {
  currentLevel: string | null;
  /** AMREntry[] ({ method, timestamp en secondes }) ou, avec un hook de jeton RFC 8176, string[] sans horodatage. */
  currentAuthenticationMethods: ({ method?: string; timestamp?: number } | string)[];
}

/**
 * Fin de la session admin côté navigateur, en millisecondes : dernier code TOTP
 * vérifié + ADMIN_SESSION_MAX_AGE_SECONDS, soit la règle de requireAdmin. `null`
 * si la session n'est pas AAL2 ou ne porte aucun TOTP horodaté.
 */
export function adminSessionExpiresAt(assurance: SessionAssurance | null | undefined): number | null {
  if (!assurance || assurance.currentLevel !== 'aal2') return null;
  const totpTimestamps = assurance.currentAuthenticationMethods
    .filter((entry): entry is { method?: string; timestamp?: number } => typeof entry === 'object' && entry !== null)
    .filter((entry) => entry.method === 'totp' && typeof entry.timestamp === 'number')
    .map((entry) => entry.timestamp as number);
  if (totpTimestamps.length === 0) return null;
  return (Math.max(...totpTimestamps) + ADMIN_SESSION_MAX_AGE_SECONDS) * 1000;
}
