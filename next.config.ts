import type { NextConfig } from 'next';
import { securityHeaders } from './lib/security/securityHeaders';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // En-têtes fixes ; la CSP (nonce par requête) est posée par middleware.ts (RGPD lot 7).
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
