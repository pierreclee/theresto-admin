// Liens courts (go.theresto.fr, P10) : règles de saisie, reprises de la base pour répondre
// avant l'écriture avec un message clair. La base fait foi (contraintes de short_links,
// déclencheur trg_guard_short_link_targets) : ces règles doivent rester identiques à
// celles de la migration 20261127110000_short_links.sql du dépôt theresto_app
// (docs/features/short-links.md, §3 et §4).

import type { AppEnvironment } from '@/lib/supabase/config';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const ATTRIBUTE_PATTERN = /^[a-z0-9-]{1,40}$/;
export const PROVIDER_TOKEN_PATTERN = /^[0-9]{1,20}$/;

/** Chemins réservés du domaine ou trompeurs dans un lien imprimé (contrainte short_links_slug_reserved). */
export const RESERVED_SLUGS: readonly string[] = [
  'admin', 'api', 'login', 'logout', 'signup', 'auth', 'www', 'go', 'app', 'hub', 'widget',
  'static', 'assets', 'health', 'status', 'robots', 'favicon', 'support', 'help', 'theresto',
];

export type ShortLinkKind = 'download' | 'web';
export type ShortLinkForwardParams = 'none' | 'utm';
export type ShortLinkPersona = 'client' | 'pro';
export type TargetScope = 'any' | 'app_store' | 'play';

const MAX_TARGET_LENGTH = 2000;
const MAX_LABEL_LENGTH = 200;

/**
 * Motifs de public.short_link_target_allowed (migration 20261127110000_short_links.sql),
 * recopiés à l'identique : chaque chaîne figure telle quelle dans la fonction SQL, et
 * new RegExp(chaîne) a le même sens en JavaScript (test shortLinkTargetsSql.test.ts).
 * Toute modification se fait d'abord dans la migration.
 */
export const TARGET_PATTERNS = {
  /** Chemin avec « // » ou un segment « . » / « .. » (avant la chaîne de requête) : refusé. */
  badPath: String.raw`^https://[^/?#]*[^?#]*(//|/\.\.?([/?#]|$))`,
  appStore: String.raw`^https://apps\.apple\.com/([a-z]{2}/)?app/([a-z0-9-]+/)?id[0-9]{1,12}([?#].*)?$`,
  play: String.raw`^https://play\.google\.com/store/apps/details\?id=com\.theresto(\.[a-z0-9_]+)*([&#].*)?$`,
  theresto: String.raw`^https://((app|hub|widget)\.)?theresto\.fr([/?#].*)?$`,
  /** Comparé sans tenir compte de la casse (!~* en SQL) : boucle via Pages, chemin encodé. */
  appExcluded: String.raw`^https://app\.theresto\.fr/(telecharger|[^?#]*%)`,
} as const;

const BAD_PATH = new RegExp(TARGET_PATTERNS.badPath);
const APP_STORE_TARGET = new RegExp(TARGET_PATTERNS.appStore);
const PLAY_TARGET = new RegExp(TARGET_PATTERNS.play);
const THERESTO_TARGET = new RegExp(TARGET_PATTERNS.theresto);
const APP_EXCLUDED = new RegExp(TARGET_PATTERNS.appExcluded, 'i');
// [[:space:][:cntrl:]\] et chr(65279) de la base : espaces, caractères de contrôle (C0, DEL,
// C1), barre oblique inverse, BOM. \s couvre aussi les espaces Unicode : jamais plus permissif.
const FORBIDDEN_CHARS = /[\s\u0000-\u001f\u007f-\u009f\\\uFEFF]/u;

/** Cible autorisée, comme short_link_target_allowed(url, scope) en base. */
export function isTargetAllowed(url: string, scope: TargetScope): boolean {
  // Longueur en points de code, comme char_length.
  if (typeof url !== 'string' || [...url].length > MAX_TARGET_LENGTH || FORBIDDEN_CHARS.test(url)) return false;
  if (BAD_PATH.test(url)) return false;
  switch (scope) {
    case 'app_store':
      return APP_STORE_TARGET.test(url);
    case 'play':
      return PLAY_TARGET.test(url);
    case 'any':
      return (THERESTO_TARGET.test(url) && !APP_EXCLUDED.test(url))
        || APP_STORE_TARGET.test(url) || PLAY_TARGET.test(url);
    default:
      return false;
  }
}

export const TARGET_RULE_MESSAGE =
  'Cible non autorisée : https vers theresto.fr, hub. ou widget. (tout chemin), app.theresto.fr '
  + '(sauf /telecharger… et un chemin encodé avec %), une fiche App Store (apps.apple.com/[pays/]app/[nom/]id123) '
  + 'ou la fiche Google Play com.theresto… ; sans port, identifiant, espace, « // » ni « .. » dans le chemin.';

export const APP_STORE_RULE_MESSAGE =
  'App Store : fiche d\'une app seulement, https://apps.apple.com/[pays/]app/[nom/]id123456789.';
export const PLAY_RULE_MESSAGE =
  'Google Play : https://play.google.com/store/apps/details?id=com.theresto (ou com.theresto.<…>) exactement.';

/** Saisie d'un lien (création ou modification complète), telle qu'envoyée par l'écran. */
export interface ShortLinkInput {
  slug: string;
  label: string | null;
  kind: ShortLinkKind;
  targetDefault: string;
  targetIos: string | null;
  targetAndroid: string | null;
  forwardParams: ShortLinkForwardParams;
  src: string | null;
  ville: string | null;
  persona: ShortLinkPersona | null;
  campaign: string | null;
  /** ISO 8601, ou null : sans fin. */
  expiresAt: string | null;
}

/** Colonnes de short_links écrites par l'admin (jamais id, created_by, created_at, updated_at, active). */
export interface ShortLinkColumns {
  slug: string;
  label: string | null;
  kind: ShortLinkKind;
  target_default: string;
  target_ios: string | null;
  target_android: string | null;
  forward_params: ShortLinkForwardParams;
  src: string | null;
  ville: string | null;
  persona: ShortLinkPersona | null;
  campaign: string | null;
  expires_at: string | null;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function attribute(value: unknown, label: string): Validation<string | null> {
  const text = optionalText(value);
  if (text === undefined) return { ok: false, error: `${label} : valeur invalide.` };
  if (text === null) return { ok: true, value: null };
  const lower = text.toLowerCase();
  if (!ATTRIBUTE_PATTERN.test(lower)) {
    return { ok: false, error: `${label} : lettres minuscules sans accent, chiffres et tirets, 40 caractères au plus.` };
  }
  return { ok: true, value: lower };
}

function target(value: unknown, label: string, required: boolean): Validation<string | null> {
  const text = optionalText(value);
  if (text === undefined) return { ok: false, error: `${label} : valeur invalide.` };
  if (text === null) return required ? { ok: false, error: `${label} : obligatoire.` } : { ok: true, value: null };
  if (!isTargetAllowed(text, 'any')) return { ok: false, error: `${label} : ${TARGET_RULE_MESSAGE}` };
  return { ok: true, value: text };
}

/** Message de refus d'un slug, ou null s'il est valable (après mise en minuscules). */
export function slugError(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) {
    return 'Slug : 2 à 40 caractères, lettres minuscules sans accent, chiffres et tirets, sans tiret au début.';
  }
  if (RESERVED_SLUGS.includes(slug)) return `Slug : « ${slug} » est réservé.`;
  return null;
}

/** Valide et normalise la saisie d'un lien (valeurs venues du navigateur, jamais de confiance). */
export function validateShortLinkInput(raw: unknown): Validation<ShortLinkColumns> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Saisie illisible.' };
  const input = raw as Record<string, unknown>;

  const slugText = optionalText(input.slug);
  if (!slugText) return { ok: false, error: 'Slug : obligatoire.' };
  const slug = slugText.toLowerCase();
  const badSlug = slugError(slug);
  if (badSlug) return { ok: false, error: badSlug };

  const label = optionalText(input.label);
  if (label === undefined) return { ok: false, error: 'Libellé : valeur invalide.' };
  if (label !== null && [...label].length > MAX_LABEL_LENGTH) {
    return { ok: false, error: `Libellé : ${MAX_LABEL_LENGTH} caractères au plus.` };
  }

  if (input.kind !== 'download' && input.kind !== 'web') return { ok: false, error: 'Type : « download » ou « web ».' };
  if (input.forwardParams !== 'none' && input.forwardParams !== 'utm') {
    return { ok: false, error: 'Paramètres transmis : « none » ou « utm ».' };
  }
  const persona = optionalText(input.persona);
  if (persona !== null && persona !== 'client' && persona !== 'pro') {
    return { ok: false, error: 'Persona : « client », « pro » ou aucune.' };
  }

  const targetDefault = target(input.targetDefault, 'Cible par défaut', true);
  if (!targetDefault.ok) return targetDefault;
  const targetIos = target(input.targetIos, 'Cible iPhone', false);
  if (!targetIos.ok) return targetIos;
  const targetAndroid = target(input.targetAndroid, 'Cible Android', false);
  if (!targetAndroid.ok) return targetAndroid;

  const src = attribute(input.src, 'Source');
  if (!src.ok) return src;
  const ville = attribute(input.ville, 'Ville');
  if (!ville.ok) return ville;
  const campaign = attribute(input.campaign, 'Campagne');
  if (!campaign.ok) return campaign;

  const expiresText = optionalText(input.expiresAt);
  if (expiresText === undefined) return { ok: false, error: 'Expiration : valeur invalide.' };
  let expiresAt: string | null = null;
  if (expiresText !== null) {
    const date = new Date(expiresText);
    if (Number.isNaN(date.getTime())) return { ok: false, error: 'Expiration : date invalide.' };
    expiresAt = date.toISOString();
  }

  return {
    ok: true,
    value: {
      slug,
      label,
      kind: input.kind,
      target_default: targetDefault.value!,
      target_ios: targetIos.value,
      target_android: targetAndroid.value,
      forward_params: input.forwardParams,
      src: src.value,
      ville: ville.value,
      persona: persona as ShortLinkPersona | null,
      campaign: campaign.value,
      expires_at: expiresAt,
    },
  };
}

/** Réglages globaux des stores (short_link_settings). */
export interface ShortLinkSettingsColumns {
  app_store_url: string | null;
  play_store_url: string | null;
  app_store_provider_token: string | null;
}

export function validateShortLinkSettingsInput(raw: unknown): Validation<ShortLinkSettingsColumns> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Saisie illisible.' };
  const input = raw as Record<string, unknown>;
  const appStore = optionalText(input.appStoreUrl);
  const play = optionalText(input.playStoreUrl);
  const token = optionalText(input.appStoreProviderToken);
  if (appStore === undefined || play === undefined || token === undefined) {
    return { ok: false, error: 'Saisie illisible.' };
  }
  if (appStore !== null && !isTargetAllowed(appStore, 'app_store')) {
    return { ok: false, error: APP_STORE_RULE_MESSAGE };
  }
  if (play !== null && !isTargetAllowed(play, 'play')) {
    return { ok: false, error: PLAY_RULE_MESSAGE };
  }
  if (token !== null && !PROVIDER_TOKEN_PATTERN.test(token)) {
    return { ok: false, error: 'Provider token App Store : chiffres seulement, 20 au plus.' };
  }
  return { ok: true, value: { app_store_url: appStore, play_store_url: play, app_store_provider_token: token } };
}

/** Noms des colonnes dont la valeur change (journal : noms de champs seulement). */
export function changedFields<T extends object>(before: Partial<T>, after: T): (keyof T & string)[] {
  return (Object.keys(after) as (keyof T & string)[]).filter((key) => (before[key] ?? null) !== (after[key] ?? null));
}

// ─── Domaine ────────────────────────────────────────────────────────────────

/** Domaine des liens courts de l'environnement choisi à la connexion (cookie theresto_env). */
export function shortLinkDomain(env: AppEnvironment): string {
  return env === 'production' ? 'go.theresto.fr' : 'theresto-go-staging.pierrecleepro.workers.dev';
}

/** URL encodée dans le QR : toujours https://<domaine>/<slug>, slug en minuscules. */
export function shortLinkUrl(domain: string, slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (slugError(normalized)) throw new Error('Slug invalide');
  return `https://${domain}/${normalized}`;
}

// ─── Erreurs de la base ─────────────────────────────────────────────────────

export const SHORT_LINK_CONFLICT_MESSAGE =
  'Ce lien a été modifié entre-temps. Rechargez la page puis recommencez.';

/** Refus de PostgreSQL / PostgREST → message en français (jamais le message brut). */
export function shortLinkDbErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  switch (error?.code) {
    case '22023':
      return TARGET_RULE_MESSAGE;
    case '23505':
      return 'Ce slug est déjà pris : choisissez-en un autre.';
    case '23514':
      return 'Format refusé par la base : vérifiez le slug (réservé ?), la source, la ville, la campagne et le libellé.'
        + " Seul le lien « telecharger » peut accepter les attributs de l'adresse.";
    case '42501':
      return 'Droits insuffisants sur la base.';
    default:
      return "L'enregistrement a échoué. Réessayez.";
  }
}
