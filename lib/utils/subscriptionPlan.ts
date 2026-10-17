/** Valeurs canoniques de subscription_plan. Le plan gratuit s'écrit 'essentiel'. */
export type SubscriptionPlanKey = 'essentiel' | 'croissance' | 'liberte' | 'premium';

/**
 * Ramène une valeur lue en base à un plan canonique. Tout ce qui n'est pas
 * croissance / liberte / premium (y compris 'free' hérité et null) vaut Essentiel,
 * comme public.plan_rank côté base.
 */
export function normalizeSubscriptionPlan(value: string | null | undefined): SubscriptionPlanKey {
  switch ((value ?? '').toLowerCase()) {
    case 'croissance':
      return 'croissance';
    case 'liberte':
    case 'liberté':
      return 'liberte';
    case 'premium':
      return 'premium';
    default:
      return 'essentiel';
  }
}
