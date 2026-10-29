// En-têtes de sécurité de l'admin (RGPD lot 7). La CSP porte un nonce par requête
// (middleware.ts) ; les autres en-têtes sont fixes (next.config.ts).
// Seul tiers contacté par le navigateur : les deux projets Supabase (API, Realtime,
// Storage). Les polices next/font/google sont téléchargées au build et servies par le site.

export function supabaseOrigins(urls: (string | undefined)[]): string[] {
  return urls
    .filter((url): url is string => Boolean(url))
    .flatMap((url) => {
      const { host } = new URL(url);
      return [`https://${host}`, `wss://${host}`];
    });
}

export function buildContentSecurityPolicy(options: {
  nonce: string;
  connect: string[];
  isDev: boolean;
}): string {
  const { nonce, connect, isDev } = options;
  const https = connect.filter((origin) => origin.startsWith('https://'));
  return [
    "default-src 'self'",
    // 'unsafe-eval' en développement seulement : React y reconstruit les piles d'erreur.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Attributs style de React et balises <style> de Next : pas de nonce possible sur un attribut.
    "style-src 'self' 'unsafe-inline'",
    // data: pour le QR code du second facteur (Supabase Auth) ; Storage pour les photos.
    `img-src 'self' data: blob: ${https.join(' ')}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${connect.join(' ')}`.trim(),
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
];
