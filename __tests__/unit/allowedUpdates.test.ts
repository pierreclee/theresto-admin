import {
  ALLOWED_RESTAURANT_UPDATE_FIELDS,
  ALLOWED_CONFIG_UPDATE_FIELDS,
  pickAllowedRestaurantUpdates,
  pickAllowedConfigUpdates,
} from '@/lib/utils/allowedUpdates';

describe('pickAllowedRestaurantUpdates', () => {
  it('garde les champs autorisés', () => {
    const input = { name: 'A', email: null, cuisine_types: ['x'], website_url: 'u' };
    const { allowed, ignored } = pickAllowedRestaurantUpdates(input);
    expect(allowed).toEqual(input);
    expect(ignored).toEqual([]);
  });

  it('retire les champs sensibles et inconnus', () => {
    const { allowed, ignored } = pickAllowedRestaurantUpdates({
      name: 'A',
      commission_rate_custom: 0.01,
      commission_rate: 0.01,
      commissionRate: 0.01,
      commission_rate_updated_at: 'x',
      approval_status: 'approved',
      subscription_plan: 'liberte',
      stripe_account_id: 'acct',
      foo: 1,
    });
    expect(allowed).toEqual({ name: 'A' });
    expect(ignored).toEqual(
      expect.arrayContaining([
        'commission_rate_custom', 'commission_rate', 'commissionRate', 'commission_rate_updated_at',
        'approval_status', 'subscription_plan', 'stripe_account_id', 'foo',
      ])
    );
  });

  it('renvoie un objet vide si tout est filtré', () => {
    const { allowed, ignored } = pickAllowedRestaurantUpdates({ commission_rate_custom: 0.02 });
    expect(allowed).toEqual({});
    expect(ignored).toEqual(['commission_rate_custom']);
  });

  it('ignore les clés héritées du prototype', () => {
    const { allowed } = pickAllowedRestaurantUpdates(JSON.parse('{"__proto__":{"name":"x"},"name":"ok"}'));
    expect(allowed).toEqual({ name: 'ok' });
  });

  it('liste exacte', () => {
    expect([...ALLOWED_RESTAURANT_UPDATE_FIELDS].sort()).toEqual([
      'address', 'cuisine_types', 'description', 'email', 'establishment_type',
      'facebook_url', 'instagram_url', 'name', 'phone_number', 'website_url',
    ]);
  });
});

describe('pickAllowedConfigUpdates', () => {
  it('garde currency et maintenanceMode, retire le reste', () => {
    const { allowed, ignored } = pickAllowedConfigUpdates({
      currency: 'EUR', maintenanceMode: true, id: 'other', commission_rate: 1, updated_by: 'x',
    });
    expect(allowed).toEqual({ currency: 'EUR', maintenanceMode: true });
    expect(ignored.sort()).toEqual(['commission_rate', 'id', 'updated_by']);
    expect([...ALLOWED_CONFIG_UPDATE_FIELDS].sort()).toEqual(['currency', 'maintenanceMode']);
  });

  it('objet vide après filtre', () => {
    expect(pickAllowedConfigUpdates({ foo: 1 }).allowed).toEqual({});
  });
});
