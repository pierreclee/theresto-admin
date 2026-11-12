// Version minimale et recommandée de l'app mobile (P10), lue et écrite par l'Edge Function
// app-version-settings du dépôt theresto_app (docs/features/app-version-policy.md).

export type AppPlatform = 'android' | 'ios';

export interface AppVersionPolicy {
  platform: AppPlatform;
  minVersion: string;
  minBuild: number;
  recommendedVersion: string;
  recommendedBuild: number;
  message: string | null;
  storeUrl: string | null;
  updatedAt: string;
}

/** Saisie complète d'une plateforme (message et lien : null pour les retirer). */
export interface AppVersionPolicyInput {
  platform: AppPlatform;
  minVersion: string;
  minBuild: number;
  recommendedVersion: string;
  recommendedBuild: number;
  message: string | null;
  storeUrl: string | null;
  expectedUpdatedAt: string;
}
