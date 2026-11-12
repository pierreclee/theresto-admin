// Règles de saisie des versions de l'app mobile (P10), reprises de l'Edge Function
// app-version-settings (_shared/app-version-settings.ts du dépôt theresto_app), qui fait foi.

import type { AppPlatform, AppVersionPolicy, AppVersionPolicyInput } from '@/lib/types/appVersion';

export const VERSION_PATTERN = /^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$/;
/** Plafond du versionCode de Google Play, même borne que la table. */
export const MAX_BUILD = 2100000000;
export const MAX_MESSAGE_LENGTH = 500;
const MAX_URL_LENGTH = 500;
export const STORE_URL_PREFIX: Record<AppPlatform, string> = {
  android: 'https://play.google.com/',
  ios: 'https://apps.apple.com/',
};
export const PLATFORM_NAMES: Record<AppPlatform, string> = { android: 'Android', ios: 'iOS' };

export const RAISE_MINIMUM_WARNING =
  'Vous relevez la version minimale : les versions plus anciennes seront bloquées sur un écran '
  + '« Mise à jour nécessaire ». Vérifiez que la nouvelle version est disponible pour tous sur le '
  + 'store (déploiement progressif terminé).';

/** Compare deux versions (x.y.z numériquement, puis le build) : < 0, 0 ou > 0. */
export function compareAppVersions(aVersion: string, aBuild: number, bVersion: string, bBuild: number): number {
  const a = [...aVersion.split('.').map(Number), aBuild];
  const b = [...bVersion.split('.').map(Number), bBuild];
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Vrai si la saisie relève le minimum : des versions jusque-là acceptées seront bloquées. */
export function raisesMinimum(
  current: Pick<AppVersionPolicy, 'minVersion' | 'minBuild'>,
  next: Pick<AppVersionPolicyInput, 'minVersion' | 'minBuild'>,
): boolean {
  return compareAppVersions(next.minVersion, next.minBuild, current.minVersion, current.minBuild) > 0;
}

/** Avertissement dès la saisie : faux tant que la version ou le build minimal est illisible. */
export function draftRaisesMinimum(
  current: Pick<AppVersionPolicy, 'minVersion' | 'minBuild'>,
  draft: Pick<AppVersionDraft, 'minVersion' | 'minBuild'>,
): boolean {
  const minVersion = draft.minVersion.trim();
  const minBuild = parseBuild(draft.minBuild);
  return VERSION_PATTERN.test(minVersion) && minBuild !== null && raisesMinimum(current, { minVersion, minBuild });
}

export interface AppVersionDraft {
  minVersion: string;
  minBuild: string;
  recommendedVersion: string;
  recommendedBuild: string;
  message: string;
  storeUrl: string;
}

export function draftFromPolicy(policy: AppVersionPolicy): AppVersionDraft {
  return {
    minVersion: policy.minVersion,
    minBuild: String(policy.minBuild),
    recommendedVersion: policy.recommendedVersion,
    recommendedBuild: String(policy.recommendedBuild),
    message: policy.message ?? '',
    storeUrl: policy.storeUrl ?? '',
  };
}

function parseBuild(raw: string): number | null {
  const text = raw.trim();
  if (!/^[0-9]{1,10}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= MAX_BUILD ? n : null;
}

/** Saisie de l'écran → corps de updateAppVersionPolicy, ou message d'erreur en français. */
export function parseAppVersionDraft(
  platform: AppPlatform,
  draft: AppVersionDraft,
  expectedUpdatedAt: string,
): { ok: true; value: AppVersionPolicyInput } | { ok: false; error: string } {
  const minVersion = draft.minVersion.trim();
  const recommendedVersion = draft.recommendedVersion.trim();
  if (!VERSION_PATTERN.test(minVersion)) return { ok: false, error: 'Version minimale : format 1.2.3 attendu.' };
  if (!VERSION_PATTERN.test(recommendedVersion)) {
    return { ok: false, error: 'Version recommandée : format 1.2.3 attendu.' };
  }
  const minBuild = parseBuild(draft.minBuild);
  if (minBuild === null) return { ok: false, error: `Build minimal : entier entre 1 et ${MAX_BUILD}.` };
  const recommendedBuild = parseBuild(draft.recommendedBuild);
  if (recommendedBuild === null) return { ok: false, error: `Build recommandé : entier entre 1 et ${MAX_BUILD}.` };
  if (compareAppVersions(recommendedVersion, recommendedBuild, minVersion, minBuild) < 0) {
    return { ok: false, error: 'La version recommandée ne peut pas être inférieure à la version minimale.' };
  }
  const message = draft.message.trim() === '' ? null : draft.message.trim();
  if (message !== null && message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Message : ${MAX_MESSAGE_LENGTH} caractères au plus.` };
  }
  const storeUrl = draft.storeUrl.trim() === '' ? null : draft.storeUrl.trim();
  if (storeUrl !== null
    && (storeUrl.length > MAX_URL_LENGTH || /\s/.test(storeUrl) || !storeUrl.startsWith(STORE_URL_PREFIX[platform]))) {
    return { ok: false, error: `Lien du store : doit commencer par ${STORE_URL_PREFIX[platform]}` };
  }
  if (storeUrl === null && compareAppVersions(recommendedVersion, recommendedBuild, '1.0.0', 1) > 0) {
    return {
      ok: false,
      error: 'Lien du store obligatoire dès qu’une version au-delà de 1.0.0 (build 1) est réglée.',
    };
  }
  return {
    ok: true,
    value: { platform, minVersion, minBuild, recommendedVersion, recommendedBuild, message, storeUrl, expectedUpdatedAt },
  };
}

export const APP_VERSION_CONFLICT_MESSAGE =
  'La version a changé entre-temps : les valeurs ont été rechargées, vérifiez-les puis recommencez.';

/** Erreur de l'Edge Function → message en français pour l'admin (ses messages 400 sont en anglais). */
export function appVersionErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'unauthenticated':
      return 'Session expirée. Reconnectez-vous puis recommencez.';
    case 'permission-denied':
      return 'Vérification en deux étapes de plus de 5 minutes, ou droits insuffisants. Saisissez un nouveau code.';
    case 'conflict':
    case 'failed-precondition':
      return APP_VERSION_CONFLICT_MESSAGE;
    case 'invalid-argument':
      return 'Valeurs refusées par le serveur : vérifiez les versions, les builds et le lien du store.';
    case 'not-found':
      return 'Plateforme introuvable.';
    case 'audit-log-failed':
      return "Modification annulée : le journal d'administration n'a pas pu être écrit. Réessayez.";
    default:
      return 'La modification a échoué. Réessayez.';
  }
}

/** Code d'erreur qui impose un nouveau code TOTP. */
export const isMfaRefusal = (code: string | undefined) => code === 'permission-denied';
/** Code d'erreur qui impose de repartir des valeurs du serveur. */
export const isConflict = (code: string | undefined) => code === 'conflict' || code === 'failed-precondition';
