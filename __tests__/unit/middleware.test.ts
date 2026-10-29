/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';

describe('middleware : CSP à nonce par requête (RGPD lot 7, D13)', () => {
  const run = () => middleware(new NextRequest('https://admin.example/restaurants'));

  it('pose la CSP sur la réponse et la transmet au rendu avec le nonce', () => {
    const response = run();
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    const nonce = response.headers.get('x-middleware-request-x-nonce');
    expect(nonce).toBeTruthy();
    expect(csp).toContain(`'nonce-${nonce}' 'strict-dynamic'`);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });

  it('un nonce différent à chaque requête', () => {
    expect(run().headers.get('x-middleware-request-x-nonce'))
      .not.toBe(run().headers.get('x-middleware-request-x-nonce'));
  });

  it('ignore les ressources statiques et les préchargements', () => {
    const [matcher] = config.matcher;
    expect(matcher.source).toContain('_next/static');
    expect(matcher.missing).toEqual(
      expect.arrayContaining([{ type: 'header', key: 'next-router-prefetch' }]),
    );
  });
});
