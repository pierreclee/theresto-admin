/**
 * Un client Supabase par environnement dans le navigateur : après une déconnexion
 * de la prod, une connexion à staging ne doit pas repartir vers la prod.
 */
// Comme @supabase/ssr dans un navigateur : singleton sauf `isSingleton: false`.
jest.mock('@supabase/ssr', () => {
  let cached: { url: string; key: string } | undefined;
  return {
    createBrowserClient: jest.fn((url: string, key: string, options?: { isSingleton?: boolean }) => {
      if (options?.isSingleton === false) return { url, key };
      return (cached ??= { url, key });
    }),
  };
});

function load() {
  // Après resetModules : la simulation et le module sont relus ensemble.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ssr = require('@supabase/ssr');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@/lib/supabase/client');
  return { createClient, mocked: ssr.createBrowserClient as jest.Mock };
}

describe('createClient (navigateur)', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL_PROD = 'https://prod.example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD = 'anon-prod';
    process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING = 'https://staging.example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING = 'anon-staging';
    document.cookie = 'theresto_env=production; path=/';
  });

  it('vise staging quand staging est choisi après un client de prod', () => {
    const { createClient } = load();
    const prod = createClient();
    const staging = createClient('staging');

    expect(prod.url).toBe('https://prod.example.supabase.co');
    expect(staging.url).toBe('https://staging.example.supabase.co');
    expect(staging).not.toBe(prod);
  });

  it('réutilise le même client pour un même environnement, sans singleton global', () => {
    const { createClient, mocked } = load();
    expect(createClient('production')).toBe(createClient());
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(mocked.mock.calls[0][2]).toEqual({ isSingleton: false });
  });
});
