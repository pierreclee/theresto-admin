// Listes blanches d'exécution pour les server actions d'écriture : le typage
// TypeScript ne protège pas contre un appel HTTP direct à la server action.
// Les champs de commission, d'approbation, de statut, d'abonnement et stripe_*
// ne passent jamais par ici (commission : Edge Function commission-settings + TOTP).

export const ALLOWED_RESTAURANT_UPDATE_FIELDS = [
  'name',
  'email',
  'phone_number',
  'address',
  'description',
  'establishment_type',
  'cuisine_types',
  'website_url',
  'instagram_url',
  'facebook_url',
] as const;

export const ALLOWED_CONFIG_UPDATE_FIELDS = ['currency', 'maintenanceMode'] as const;

function pickAllowed(
  input: unknown,
  allowedKeys: readonly string[]
): { allowed: Record<string, unknown>; ignored: string[] } {
  const allowed: Record<string, unknown> = {};
  const ignored: string[] = [];
  if (!input || typeof input !== 'object') return { allowed, ignored };
  for (const key of Object.keys(input)) {
    if (allowedKeys.includes(key)) {
      allowed[key] = (input as Record<string, unknown>)[key];
    } else {
      ignored.push(key);
    }
  }
  return { allowed, ignored };
}

export function pickAllowedRestaurantUpdates(input: unknown) {
  return pickAllowed(input, ALLOWED_RESTAURANT_UPDATE_FIELDS);
}

export function pickAllowedConfigUpdates(input: unknown) {
  return pickAllowed(input, ALLOWED_CONFIG_UPDATE_FIELDS);
}
