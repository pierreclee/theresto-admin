import { buildContentSecurityPolicy, securityHeaders, supabaseOrigins } from '@/lib/security/securityHeaders';

describe('en-têtes de sécurité (RGPD lot 7)', () => {
  const connect = supabaseOrigins(['https://prod.supabase.co', undefined, 'https://stg.supabase.co/']);

  it('origines Supabase en https et wss', () => {
    expect(connect).toEqual([
      'https://prod.supabase.co', 'wss://prod.supabase.co',
      'https://stg.supabase.co', 'wss://stg.supabase.co',
    ]);
  });

  it('CSP à nonce, sans script en ligne ni encadrement', () => {
    const csp = buildContentSecurityPolicy({ nonce: 'abc', connect, isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://prod.supabase.co wss://prod.supabase.co");
  });

  it('images du Storage Supabase (https seulement) et QR du second facteur (data:)', () => {
    const csp = buildContentSecurityPolicy({ nonce: 'abc', connect, isDev: false });
    expect(csp).toContain("img-src 'self' data: blob: https://prod.supabase.co https://stg.supabase.co;");
  });

  it('unsafe-eval seulement en développement (rechargement React)', () => {
    expect(buildContentSecurityPolicy({ nonce: 'n', connect, isDev: true })).toContain("'unsafe-eval'");
  });

  it('HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy', () => {
    const keys = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));
    expect(keys['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(keys['X-Content-Type-Options']).toBe('nosniff');
    expect(keys['X-Frame-Options']).toBe('DENY');
    expect(keys['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(keys['Permissions-Policy']).toContain('camera=()');
    expect(keys['Content-Security-Policy']).toBeUndefined();
  });
});
