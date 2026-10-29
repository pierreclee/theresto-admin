import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy, supabaseOrigins } from '@/lib/security/securityHeaders';

const connect = supabaseOrigins([
  process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
  process.env.NEXT_PUBLIC_SUPABASE_URL_STAGING,
]);

// CSP à nonce (RGPD lot 7, D13) : Next lit le nonce dans l'en-tête CSP de la requête et
// l'applique à ses propres scripts (pages rendues à chaque requête, app/layout.tsx).
// L'authentification reste vérifiée par AdminGuard et côté serveur (requireAdmin).
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy({
    nonce,
    connect,
    isDev: process.env.NODE_ENV === 'development',
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
