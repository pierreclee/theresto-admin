import { normalizeSubscriptionPlan } from '@/lib/utils/subscriptionPlan';

describe('normalizeSubscriptionPlan', () => {
  it.each([
    ['croissance', 'croissance'],
    ['liberte', 'liberte'],
    ['liberté', 'liberte'],
    ['premium', 'premium'],
    ['PREMIUM', 'premium'],
    ['Croissance', 'croissance'],
    ['essentiel', 'essentiel'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSubscriptionPlan(input)).toBe(expected);
  });

  it.each([['free'], ['FREE'], [''], ['inconnu'], [null], [undefined]])(
    '%p est lu comme Essentiel',
    (input) => {
      expect(normalizeSubscriptionPlan(input)).toBe('essentiel');
    },
  );
});
