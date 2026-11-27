// Préremplissage d'une invitation depuis une fiche Twenty (SIREN validé, photo validée).
// Contrat de l'Edge Function admin-onboarding (actions searchTwentyCompanies et
// createRestaurantInvitation) : docs/features/onboarding-accompagne.md de l'app.
// Sans dépendance serveur : utilisé par les actions et par les écrans.

/** Fiche Twenty trouvée par la recherche (jamais le SIREN lui-même). */
export interface TwentyCompany {
  id: string;
  name: string;
  city: string | null;
  sirenValidated: boolean;
  photoValidated: boolean;
  /** Seulement si la photo est validée. */
  photoLabel: string | null;
  /** Seulement si la photo est validée, et seulement en https. */
  photoUrl: string | null;
}

/** Préremplissage demandé avec l'invitation. */
export interface InvitationPrefillRequest {
  twentyCompanyId: string;
  /** Le restaurateur accepte que TheResto utilise la photo (case, non cochée par défaut). */
  photoConsent: boolean;
  /**
   * URL de la photo montrée à l'admin (« Voir la photo », reçue de la recherche), envoyée
   * seulement avec l'accord : la fonction refuse ('changed') une photo changée depuis.
   */
  photoUrl?: string | null;
}

export const PREFILL_PHOTO_OUTCOMES = [
  'ok', 'none', 'no-consent', 'refused-host', 'failed', 'too-small', 'too-large', 'bad-type', 'changed',
] as const;
export type PrefillPhotoOutcome = (typeof PREFILL_PHOTO_OUTCOMES)[number];
/** Raison que cette version de l'admin ne connaît pas (fonction plus récente). */
export type PrefillPhotoResult = PrefillPhotoOutcome | 'unknown';

/** Résultat du préremplissage renvoyé par la fonction (null : invitation sans fiche). */
export interface InvitationPrefillResult {
  siren: boolean;
  photo: PrefillPhotoResult;
}

export const TWENTY_QUERY_MIN = 2;
export const TWENTY_QUERY_MAX = 80;
export const TWENTY_SEARCH_DELAY_MS = 400;

export const TWENTY_UNAVAILABLE_MESSAGE =
  'CRM Twenty indisponible : vous pouvez inviter sans fiche, ou réessayer plus tard.';
export const TWENTY_INVALID_QUERY_MESSAGE = 'Saisissez entre 2 et 80 caractères.';

/** Message affiché pour un refus de l'Edge Function lié à Twenty, ou null pour les autres. */
export function twentyErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'twenty-unavailable':
      return TWENTY_UNAVAILABLE_MESSAGE;
    case 'invalid-query':
      return TWENTY_INVALID_QUERY_MESSAGE;
    case 'invalid-company':
      return 'Fiche Twenty invalide : retirez-la et choisissez-en une autre.';
    case 'company-not-found':
      return 'Fiche Twenty introuvable (supprimée ?) : retirez-la et choisissez-en une autre.';
    default:
      return null;
  }
}

/** Requête de recherche nettoyée, ou null si elle est trop courte ou trop longue. */
export function normalizeTwentyQuery(query: string): string | null {
  const q = query.trim();
  return q.length >= TWENTY_QUERY_MIN && q.length <= TWENTY_QUERY_MAX ? q : null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** URL https seulement (le lien « Voir la photo » n'ouvre jamais javascript:, data:…). */
export function safeHttpsUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    return new URL(s).protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

/** Fiches de la réponse, lues défensivement (une entrée mal formée est écartée). */
export function parseTwentyCompanies(data: unknown): TwentyCompany[] {
  const list = (data as { companies?: unknown } | null | undefined)?.companies;
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw): TwentyCompany[] => {
    const c = raw as Record<string, unknown> | null;
    const id = str(c?.id);
    const name = str(c?.name);
    if (!c || !id || !name) return [];
    const photoValidated = c.photoValidated === true;
    return [{
      id,
      name,
      city: str(c.city),
      sirenValidated: c.sirenValidated === true,
      photoValidated,
      photoLabel: photoValidated ? str(c.photoLabel) : null,
      photoUrl: photoValidated ? safeHttpsUrl(c.photoUrl) : null,
    }];
  });
}

/** Préremplissage de la réponse ; null s'il est absent ou mal formé. */
export function parsePrefillResult(v: unknown): InvitationPrefillResult | null {
  const p = v as { siren?: unknown; photo?: unknown } | null | undefined;
  if (!p || typeof p !== 'object') return null;
  const photo = (PREFILL_PHOTO_OUTCOMES as readonly string[]).includes(p.photo as string)
    ? (p.photo as PrefillPhotoOutcome)
    : 'unknown';
  return { siren: p.siren === true, photo };
}

const PHOTO_MESSAGES: Record<PrefillPhotoResult, string> = {
  ok: 'Photo préremplie',
  none: 'Photo non préremplie : aucune photo validée dans Twenty',
  'no-consent': 'Photo non préremplie : le restaurateur n’a pas donné son accord',
  'refused-host': 'Photo non préremplie : l’hébergeur de l’image n’est pas autorisé',
  failed: 'Photo non préremplie : téléchargement impossible',
  'too-small': 'Photo non préremplie : image trop petite (800 × 600 minimum)',
  'too-large': 'Photo non préremplie : image trop lourde (5 Mo maximum)',
  'bad-type': 'Photo non préremplie : format non reconnu (JPEG, PNG ou WebP attendu)',
  changed:
    'La photo a changé dans Twenty depuis votre vérification : elle n’a pas été reprise. '
    + 'Revoyez-la puis recréez le lien.',
  unknown: 'Photo non préremplie (raison inconnue)',
};

export interface PrefillLine {
  ok: boolean;
  text: string;
}

/** Lignes affichées après la création de l'invitation. */
export function prefillLines(prefill: InvitationPrefillResult): PrefillLine[] {
  return [
    prefill.siren
      ? { ok: true, text: 'SIREN prérempli' }
      : { ok: false, text: 'SIREN non prérempli : pas de SIREN validé dans Twenty' },
    { ok: prefill.photo === 'ok', text: PHOTO_MESSAGES[prefill.photo] ?? PHOTO_MESSAGES.unknown },
  ];
}

/** Fiche demandée mais réponse sans préremplissage : fonction du serveur pas à jour. */
export const PREFILL_NOT_APPLIED_MESSAGE =
  'Préremplissage non appliqué : la fonction du serveur (admin-onboarding) n’est pas à jour. '
  + 'Le restaurateur saisira lui-même son SIREN et sa photo.';
